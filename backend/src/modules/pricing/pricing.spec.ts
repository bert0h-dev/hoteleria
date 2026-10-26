import {
  adjustRate,
  calculateDayCheckOut,
  calculateVariableNightlyStay,
  nightAdjustment,
  priceNights,
  calculateExtraGuests,
  calculateHourlyStay,
  calculateNightlyStay,
  calculateRates,
  calculateTaxBreakdown,
  hoursUntilDayRate,
  type PricingSettings,
} from './pricing.js';

const defaults: PricingSettings = {
  hourlyRatePercent: 15,
  minHours: 3,
  dayRatePercent: 120,
  dayDurationHours: 24,
  weekRatePercent: 600,
  capHourlyAtDayRate: true,
};

describe('calculateRates', () => {
  it('aplica las fórmulas por defecto (hora 15 %, día 120 %, semana 6×)', () => {
    expect(calculateRates(1000, defaults)).toEqual({
      hourly: 150,
      nightly: 1000,
      daily: 1200,
      weekly: 6000,
    });
  });

  it('redondea al peso más cercano', () => {
    // 15 % de 1250 = 187.5 → 188; 15 % de 1230 = 184.5 → 185; 15 % de 1233 = 184.95 → 185
    expect(calculateRates(1250, defaults).hourly).toBe(188);
    expect(calculateRates(1230, defaults).hourly).toBe(185);
    expect(calculateRates(1233, defaults).hourly).toBe(185);
    // 120 % de 999 = 1198.8 → 1199
    expect(calculateRates(999, defaults).daily).toBe(1199);
  });

  it('usa los porcentajes configurados por el hotel', () => {
    const custom = { ...defaults, hourlyRatePercent: 18, weekRatePercent: 550 };
    expect(calculateRates(1000, custom)).toMatchObject({
      hourly: 180,
      weekly: 5500,
    });
  });
});

describe('calculateHourlyStay', () => {
  it('cobra el mínimo de horas configurado', () => {
    expect(calculateHourlyStay(1, 1000, defaults)).toEqual({
      billedHours: 3,
      rate: 150,
      total: 450,
      cappedAtDay: false,
    });
    expect(
      calculateHourlyStay(2, 1000, { ...defaults, minHours: 5 }).total,
    ).toBe(750);
  });

  it('cobra horas completas cuando se pasa del mínimo', () => {
    expect(calculateHourlyStay(4, 1000, defaults).total).toBe(600);
    expect(calculateHourlyStay(4.2, 1000, defaults).billedHours).toBe(5);
  });

  it('con el tope activo nunca cobra más que el día completo', () => {
    // 10 h × 150 = 1500 > día 1200 → se cobra el día
    expect(calculateHourlyStay(10, 1000, defaults)).toMatchObject({
      billedHours: 10,
      total: 1200,
      cappedAtDay: true,
    });
    // 8 h × 150 = 1200 = día → no se marca como tope
    expect(calculateHourlyStay(8, 1000, defaults).cappedAtDay).toBe(false);
  });

  it('sin el tope cobra todas las horas', () => {
    const noCap = { ...defaults, capHourlyAtDayRate: false };
    expect(calculateHourlyStay(10, 1000, noCap).total).toBe(1500);
  });
});

describe('hoursUntilDayRate', () => {
  it('indica desde cuántas horas conviene el día', () => {
    expect(hoursUntilDayRate(1000, defaults)).toBe(8);
    expect(
      hoursUntilDayRate(1000, { ...defaults, capHourlyAtDayRate: false }),
    ).toBeNull();
  });
});

describe('calculateNightlyStay', () => {
  it('cobra noches sueltas a precio de noche', () => {
    expect(calculateNightlyStay(3, 1000, defaults)).toEqual({
      weeks: 0,
      extraNights: 3,
      total: 3000,
    });
  });

  it('aplica la semana por bloques', () => {
    expect(calculateNightlyStay(7, 1000, defaults).total).toBe(6000);
    // 10 noches = 1 semana + 3 noches
    expect(calculateNightlyStay(10, 1000, defaults)).toEqual({
      weeks: 1,
      extraNights: 3,
      total: 9000,
    });
    // 15 noches = 2 semanas + 1 noche
    expect(calculateNightlyStay(15, 1000, defaults).total).toBe(13000);
  });
});

describe('calculateDayCheckOut', () => {
  it('suma la duración configurada del día a la hora de entrada', () => {
    const checkIn = new Date('2026-10-25T10:30:00Z');
    expect(calculateDayCheckOut(checkIn, defaults).toISOString()).toBe(
      '2026-10-26T10:30:00.000Z',
    );
    expect(
      calculateDayCheckOut(checkIn, { dayDurationHours: 12 }).toISOString(),
    ).toBe('2026-10-25T22:30:00.000Z');
  });
});

describe('calculateExtraGuests', () => {
  const doble = { includedAdults: 2, extraAdultRate: 250, extraChildRate: 100 };

  it('cobra adultos por encima de los incluidos y cada niño, por noche', () => {
    // 3 adultos + 2 niños: 1 × 250 + 2 × 100 = 450 por noche; 3 noches
    expect(
      calculateExtraGuests({ adults: 3, children: 2 }, doble, {
        modality: 'nightly',
        units: 3,
      }),
    ).toEqual({ extraAdults: 1, perUnit: 450, total: 1350 });
  });

  it('sin personas extra no hay cargo', () => {
    expect(
      calculateExtraGuests({ adults: 2, children: 0 }, doble, {
        modality: 'daily',
        units: 1,
      }).total,
    ).toBe(0);
  });

  it('las semanas cuentan como 7 noches y por horas no se cobra', () => {
    const guests = { adults: 3, children: 0 };
    expect(
      calculateExtraGuests(guests, doble, { modality: 'nightly', units: 7 })
        .total,
    ).toBe(1750);
    expect(
      calculateExtraGuests(guests, doble, { modality: 'hourly', units: 5 })
        .total,
    ).toBe(0);
  });
});

describe('calculateTaxBreakdown', () => {
  const taxes = { vatPercent: 16, lodgingTaxPercent: 3 };

  it('desglosa un precio con IVA e ISH incluidos', () => {
    expect(calculateTaxBreakdown(1000, taxes)).toEqual({
      subtotal: 840.34,
      vat: 134.45,
      lodgingTax: 25.21,
      total: 1000,
    });
  });

  it('la suma siempre cuadra exactamente con el total', () => {
    const configs = [
      taxes,
      { vatPercent: 16, lodgingTaxPercent: 5 },
      { vatPercent: 16, lodgingTaxPercent: 2.5 },
      { vatPercent: 8, lodgingTaxPercent: 0 },
    ];
    for (const config of configs) {
      for (const total of [1, 99, 850, 1199, 1250, 2500, 15000, 123457]) {
        const b = calculateTaxBreakdown(total, config);
        const sumCents =
          Math.round(b.subtotal * 100) +
          Math.round(b.vat * 100) +
          Math.round(b.lodgingTax * 100);
        expect(sumCents).toBe(total * 100);
      }
    }
  });

  it('sin impuestos todo es subtotal', () => {
    expect(
      calculateTaxBreakdown(500, { vatPercent: 0, lodgingTaxPercent: 0 }),
    ).toEqual({ subtotal: 500, vat: 0, lodgingTax: 0, total: 500 });
  });
});

describe('temporadas y días de la semana', () => {
  const seasons = [
    {
      name: 'Diciembre',
      startDate: '2026-12-15',
      endDate: '2027-01-06',
      adjustmentPercent: 30,
      priority: 0,
    },
    {
      name: 'Navidad',
      startDate: '2026-12-24',
      endDate: '2026-12-25',
      adjustmentPercent: 50,
      priority: 0,
    },
    {
      name: 'Baja',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      adjustmentPercent: -15,
      priority: 0,
    },
  ];
  const weekend = { days: [5, 6], percent: 15 }; // viernes y sábado

  it('aplica el ajuste por día de la semana fuera de temporada', () => {
    // 2026-11-13 es viernes; 2026-11-12, jueves.
    expect(nightAdjustment('2026-11-13', seasons, weekend)).toEqual({
      adjustmentPercent: 15,
      source: 'weekday',
    });
    expect(nightAdjustment('2026-11-12', seasons, weekend).source).toBe('base');
  });

  it('en temporada solo aplica la temporada (no se suma el fin de semana)', () => {
    // 2026-12-18 es viernes, dentro de "Diciembre".
    expect(nightAdjustment('2026-12-18', seasons, weekend)).toEqual({
      adjustmentPercent: 30,
      source: 'season',
      seasonName: 'Diciembre',
    });
  });

  it('si se enciman gana la de mayor prioridad y, si empatan, la más corta', () => {
    expect(nightAdjustment('2026-12-24', seasons).seasonName).toBe('Navidad');
    const conPrioridad = [
      ...seasons,
      { ...seasons[0], name: 'Alta', priority: 5 },
    ];
    expect(nightAdjustment('2026-12-24', conPrioridad).seasonName).toBe('Alta');
  });

  it('calcula cada noche y redondea al peso', () => {
    const nights = priceNights(
      999,
      ['2026-09-10', '2026-11-13', '2026-12-24'],
      seasons,
      weekend,
    );
    // 999 × 0.85 = 849.15 → 849; × 1.15 = 1148.85 → 1149; × 1.5 = 1498.5 → 1499
    expect(nights.map((n) => n.rate)).toEqual([849, 1149, 1499]);
    expect(adjustRate(1000, -15)).toBe(850);
  });

  it('semana por bloques con precios variables', () => {
    const flat = Array.from({ length: 10 }, () => ({ rate: 1000 }));
    // Sin ajustes coincide con la fórmula fija: 6000 + 3000.
    expect(calculateVariableNightlyStay(flat, defaults).total).toBe(9000);

    const mixed = [1000, 1000, 1000, 1000, 1150, 1150, 1000].map((rate) => ({
      rate,
    }));
    // (7300 × 600 / 700) = 6257.14 → 6257
    expect(calculateVariableNightlyStay(mixed, defaults)).toEqual({
      weeks: 1,
      extraNights: 0,
      total: 6257,
    });
  });
});
