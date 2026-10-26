import {
  computeQuote,
  computeStay,
  peakOccupancy,
  StayError,
  suggestTimeCharge,
  type StaySettings,
} from './stay.js';

const settings: StaySettings = {
  hourlyRatePercent: 15,
  minHours: 3,
  dayRatePercent: 120,
  dayDurationHours: 24,
  weekRatePercent: 600,
  capHourlyAtDayRate: true,
  vatPercent: 16,
  lodgingTaxPercent: 3,
  checkInTime: '15:00',
  checkOutTime: '12:00',
};
const TZ = 'America/Mexico_City'; // UTC-6

describe('computeStay', () => {
  it('por noche: usa el horario del hotel y cuenta las noches', () => {
    const stay = computeStay(
      {
        modality: 'NIGHTLY',
        arrivalDate: '2026-11-10',
        departureDate: '2026-11-13',
      },
      settings,
      TZ,
    );
    expect(stay.units).toBe(3);
    expect(stay.checkIn.toISOString()).toBe('2026-11-10T21:00:00.000Z');
    expect(stay.checkOut.toISOString()).toBe('2026-11-13T18:00:00.000Z');
  });

  it('por día: la salida es la entrada más la duración configurada', () => {
    const stay = computeStay(
      {
        modality: 'DAILY',
        arrivalDate: '2026-11-10',
        arrivalTime: '10:30',
        units: 2,
      },
      settings,
      TZ,
    );
    expect(stay.checkIn.toISOString()).toBe('2026-11-10T16:30:00.000Z');
    expect(stay.checkOut.toISOString()).toBe('2026-11-12T16:30:00.000Z');
  });

  it('por horas: la salida es la entrada más las horas', () => {
    const stay = computeStay(
      {
        modality: 'HOURLY',
        arrivalDate: '2026-11-10',
        arrivalTime: '22:00',
        units: 4,
      },
      settings,
      TZ,
    );
    expect(stay.checkOut.toISOString()).toBe('2026-11-11T08:00:00.000Z');
  });

  it('rechaza estancias inválidas', () => {
    expect(() =>
      computeStay(
        {
          modality: 'NIGHTLY',
          arrivalDate: '2026-11-10',
          departureDate: '2026-11-10',
        },
        settings,
        TZ,
      ),
    ).toThrow(StayError);
    expect(() =>
      computeStay(
        { modality: 'HOURLY', arrivalDate: '2026-11-10', units: 2 },
        settings,
        TZ,
      ),
    ).toThrow('Indica la hora de entrada');
  });
});

describe('computeQuote', () => {
  const doble = {
    nightlyRate: 1000,
    includedAdults: 2,
    extraAdultRate: 250,
    extraChildRate: 100,
  };

  it('por noche con semana por bloques y personas extra', () => {
    // 10 noches = 1 semana (6000) + 3 noches (3000); 1 adulto extra × 10 = 2500
    const q = computeQuote(
      doble,
      { units: 10 },
      'NIGHTLY',
      { adults: 3, children: 0 },
      settings,
    );
    expect(q).toMatchObject({
      baseAmount: 9000,
      extrasAmount: 2500,
      totalAmount: 11500,
    });
    expect(q.detail).toMatchObject({
      weeks: 1,
      extraNights: 3,
      extraAdults: 1,
    });
    expect(q.detail.taxes.total).toBe(11500);
  });

  it('por día cobra el 120 % por día y las personas extra por día', () => {
    const q = computeQuote(
      doble,
      { units: 2 },
      'DAILY',
      { adults: 2, children: 1 },
      settings,
    );
    expect(q).toMatchObject({
      baseAmount: 2400,
      extrasAmount: 200,
      totalAmount: 2600,
    });
  });

  it('por horas: mínimo, tope al día y sin cargo por personas extra', () => {
    const corto = computeQuote(
      doble,
      { units: 1 },
      'HOURLY',
      { adults: 3, children: 1 },
      settings,
    );
    expect(corto).toMatchObject({ baseAmount: 450, extrasAmount: 0 });
    expect(corto.detail.billedHours).toBe(3);

    const largo = computeQuote(
      doble,
      { units: 10 },
      'HOURLY',
      { adults: 2, children: 0 },
      settings,
    );
    expect(largo.baseAmount).toBe(1200);
    expect(largo.detail.cappedAtDay).toBe(true);
  });
});

describe('peakOccupancy', () => {
  const at = (d: string) => new Date(`2026-11-${d}:00Z`);
  const range = [at('01T00:00'), at('30T00:00')] as const;

  it('cuenta el máximo de estancias simultáneas, no el total', () => {
    const stays = [
      { checkIn: at('10T21:00'), checkOut: at('12T18:00') },
      { checkIn: at('12T21:00'), checkOut: at('14T18:00') }, // no se cruza con la 1
      { checkIn: at('11T21:00'), checkOut: at('13T18:00') }, // se cruza con ambas
    ];
    expect(peakOccupancy(stays, ...range)).toBe(2);
  });

  it('quien sale a la misma hora libera la habitación para quien entra', () => {
    const stays = [
      { checkIn: at('10T21:00'), checkOut: at('12T18:00') },
      { checkIn: at('12T18:00'), checkOut: at('13T18:00') },
    ];
    expect(peakOccupancy(stays, ...range)).toBe(1);
  });

  it('solo considera la parte de cada estancia dentro del rango', () => {
    const stays = [
      { checkIn: at('01T00:00'), checkOut: at('05T00:00') },
      { checkIn: at('03T00:00'), checkOut: at('08T00:00') },
    ];
    expect(peakOccupancy(stays, at('05T00:00'), at('10T00:00'))).toBe(1);
  });
});

describe('computeQuote con temporadas', () => {
  const doble = {
    nightlyRate: 1000,
    includedAdults: 2,
    extraAdultRate: 250,
    extraChildRate: 100,
  };
  const calendar = {
    arrivalDate: '2026-11-12', // jueves
    seasons: [],
    weekday: { days: [5, 6], percent: 15 },
  };

  it('por noche: cada noche con su ajuste; personas extra fijas', () => {
    // Jue 1000, vie 1150, sáb 1150; 1 adulto extra × 3 = 750
    const q = computeQuote(
      doble,
      { units: 3 },
      'NIGHTLY',
      { adults: 3, children: 0 },
      settings,
      calendar,
    );
    expect(q).toMatchObject({
      baseAmount: 3300,
      extrasAmount: 750,
      totalAmount: 4050,
    });
    expect(q.detail.nights?.map((n) => n.source)).toEqual([
      'base',
      'weekday',
      'weekday',
    ]);
  });

  it('en temporada no se suma el ajuste de fin de semana', () => {
    const q = computeQuote(
      doble,
      { units: 2 },
      'NIGHTLY',
      { adults: 2, children: 0 },
      settings,
      {
        ...calendar,
        arrivalDate: '2026-11-13', // viernes
        seasons: [
          {
            name: 'Puente',
            startDate: '2026-11-13',
            endDate: '2026-11-16',
            adjustmentPercent: 30,
            priority: 0,
          },
        ],
      },
    );
    expect(q.baseAmount).toBe(2600); // 1300 + 1300
  });

  it('por día y por horas usan el precio ajustado del día de entrada', () => {
    const viernes = { ...calendar, arrivalDate: '2026-11-13' };
    // 1150 × 120 % = 1380
    expect(
      computeQuote(
        doble,
        { units: 1 },
        'DAILY',
        { adults: 2, children: 0 },
        settings,
        viernes,
      ).baseAmount,
    ).toBe(1380);
    // 1150 × 15 % = 172.5 → 173; mínimo 3 h = 519
    expect(
      computeQuote(
        doble,
        { units: 2 },
        'HOURLY',
        { adults: 2, children: 0 },
        settings,
        viernes,
      ).baseAmount,
    ).toBe(519);
  });
});

describe('suggestTimeCharge', () => {
  const base = {
    nightlyRate: 1000,
    graceMinutes: 30,
    settings,
    scheduled: new Date('2026-11-10T21:00:00Z'), // 15:00 en CDMX
  };

  it('dentro de la tolerancia no hay cargo', () => {
    expect(
      suggestTimeCharge({
        ...base,
        direction: 'early',
        actual: new Date('2026-11-10T20:35:00Z'),
      }),
    ).toBeNull();
  });

  it('entrada anticipada: horas completas × tarifa por hora', () => {
    // Llega 2 h 10 min antes → 3 h × 150 = 450
    expect(
      suggestTimeCharge({
        ...base,
        direction: 'early',
        actual: new Date('2026-11-10T18:50:00Z'),
      }),
    ).toEqual({ hours: 3, amount: 450 });
  });

  it('salida tardía con tope al precio del día', () => {
    // Sale 10 h tarde → 10 × 150 = 1500, tope día 1200
    expect(
      suggestTimeCharge({
        ...base,
        direction: 'late',
        actual: new Date('2026-11-11T07:00:00Z'),
      }),
    ).toEqual({ hours: 10, amount: 1200 });
  });
});
