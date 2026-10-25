import {
  calculateDayCheckOut,
  calculateHourlyStay,
  calculateNightlyStay,
  calculateRates,
  type PricingSettings,
} from './pricing.js';

const defaults: PricingSettings = {
  hourlyRatePercent: 15,
  minHours: 3,
  dayRatePercent: 120,
  dayDurationHours: 24,
  weekRatePercent: 600,
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
    });
    expect(
      calculateHourlyStay(2, 1000, { ...defaults, minHours: 5 }).total,
    ).toBe(750);
  });

  it('cobra horas completas cuando se pasa del mínimo', () => {
    expect(calculateHourlyStay(4, 1000, defaults).total).toBe(600);
    expect(calculateHourlyStay(4.2, 1000, defaults).billedHours).toBe(5);
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
