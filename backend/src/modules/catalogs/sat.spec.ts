import {
  isValidRfc,
  normalizeRfc,
  personTypeOf,
  validateTaxProfile,
} from './sat.js';

describe('RFC', () => {
  it('acepta RFC de persona física (13) y moral (12)', () => {
    expect(isValidRfc('GODE561231GR8')).toBe(true);
    expect(isValidRfc('ABC010101AB1')).toBe(true);
    expect(personTypeOf('GODE561231GR8')).toBe('FISICA');
    expect(personTypeOf('ABC010101AB1')).toBe('MORAL');
  });

  it('normaliza mayúsculas, espacios y guiones', () => {
    expect(normalizeRfc(' gode-561231-gr8 ')).toBe('GODE561231GR8');
    expect(isValidRfc('gode 561231 gr8')).toBe(true);
  });

  it('rechaza formatos inválidos', () => {
    expect(isValidRfc('GODE561331GR8')).toBe(false); // mes 13
    expect(isValidRfc('GODE561232GR8')).toBe(false); // día 32
    expect(isValidRfc('GO561231GR8')).toBe(false); // muy corto
    expect(isValidRfc('GODE561231GR')).toBe(false); // sin homoclave completa
  });
});

describe('validateTaxProfile', () => {
  it('acepta combinaciones válidas', () => {
    expect(
      validateTaxProfile({
        rfc: 'GODE561231GR8',
        taxRegime: '612',
        cfdiUse: 'G03',
      }),
    ).toEqual([]);
    expect(
      validateTaxProfile({
        rfc: 'ABC010101AB1',
        taxRegime: '601',
        cfdiUse: 'G03',
      }),
    ).toEqual([]);
    expect(
      validateTaxProfile({
        rfc: 'ABC010101AB1',
        taxRegime: '626',
        cfdiUse: 'G03',
      }),
    ).toEqual([]);
  });

  it('rechaza un régimen que no corresponde al tipo de persona', () => {
    expect(
      validateTaxProfile({
        rfc: 'ABC010101AB1',
        taxRegime: '605',
        cfdiUse: 'G03',
      }),
    ).toEqual(['El régimen 605 no aplica a una persona moral']);
    expect(
      validateTaxProfile({
        rfc: 'GODE561231GR8',
        taxRegime: '601',
        cfdiUse: 'G03',
      }),
    ).toEqual(['El régimen 601 no aplica a una persona física']);
  });

  it('el RFC genérico exige régimen 616 y uso S01', () => {
    expect(
      validateTaxProfile({
        rfc: 'XAXX010101000',
        taxRegime: '616',
        cfdiUse: 'S01',
      }),
    ).toEqual([]);
    expect(
      validateTaxProfile({
        rfc: 'XAXX010101000',
        taxRegime: '612',
        cfdiUse: 'G03',
      }),
    ).toHaveLength(1);
  });

  it('rechaza claves que no existen en el catálogo', () => {
    expect(
      validateTaxProfile({
        rfc: 'GODE561231GR8',
        taxRegime: '999',
        cfdiUse: 'Z99',
      }),
    ).toEqual([
      'El régimen fiscal no es válido',
      'El uso de CFDI no es válido',
    ]);
  });
});
