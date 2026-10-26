import {
  buildSearchText,
  normalizeForSearch,
  phoneDigits,
  searchTerms,
} from './guest-search.js';

describe('búsqueda de huéspedes', () => {
  it('quita acentos, eñes y mayúsculas', () => {
    expect(normalizeForSearch('  José  ÑÚÑEZ  ')).toBe('jose nunez');
  });

  it('arma el texto de búsqueda con todos los datos útiles', () => {
    expect(
      buildSearchText({
        firstName: 'María José',
        lastName: 'Pérez López',
        email: 'Maria@Correo.com',
        phone: '(998) 123-4567',
        documentNumber: 'PEPL800101',
        rfcs: ['PELM800101AB1'],
      }),
    ).toBe(
      'maria jose perez lopez maria@correo.com 9981234567 pepl800101 pelm800101ab1',
    );
  });

  it('separa la búsqueda en palabras normalizadas', () => {
    expect(searchTerms('Pérez  maria')).toEqual(['perez', 'maria']);
  });

  it('una búsqueda con forma de teléfono usa solo los dígitos', () => {
    expect(searchTerms('998 123 4567')).toEqual(['9981234567']);
    expect(phoneDigits('+52 (998) 123-4567')).toBe('529981234567');
  });
});
