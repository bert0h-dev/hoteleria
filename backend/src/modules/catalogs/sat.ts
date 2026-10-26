/**
 * Catálogos del SAT para CFDI 4.0 y validación de RFC.
 * Solo se incluyen las claves útiles para facturar hospedaje.
 */

export type PersonType = 'FISICA' | 'MORAL';

export interface TaxRegime {
  code: string;
  name: string;
  /** Tipos de persona que pueden usar el régimen. */
  appliesTo: PersonType[];
}

// c_RegimenFiscal
export const TAX_REGIMES: TaxRegime[] = [
  {
    code: '601',
    name: 'General de Ley Personas Morales',
    appliesTo: ['MORAL'],
  },
  {
    code: '603',
    name: 'Personas Morales con Fines no Lucrativos',
    appliesTo: ['MORAL'],
  },
  {
    code: '605',
    name: 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
    appliesTo: ['FISICA'],
  },
  { code: '606', name: 'Arrendamiento', appliesTo: ['FISICA'] },
  {
    code: '607',
    name: 'Régimen de Enajenación o Adquisición de Bienes',
    appliesTo: ['FISICA'],
  },
  { code: '608', name: 'Demás ingresos', appliesTo: ['FISICA'] },
  {
    code: '610',
    name: 'Residentes en el Extranjero sin Establecimiento Permanente en México',
    appliesTo: ['FISICA', 'MORAL'],
  },
  {
    code: '611',
    name: 'Ingresos por Dividendos (socios y accionistas)',
    appliesTo: ['FISICA'],
  },
  {
    code: '612',
    name: 'Personas Físicas con Actividades Empresariales y Profesionales',
    appliesTo: ['FISICA'],
  },
  { code: '614', name: 'Ingresos por intereses', appliesTo: ['FISICA'] },
  {
    code: '615',
    name: 'Régimen de los ingresos por obtención de premios',
    appliesTo: ['FISICA'],
  },
  { code: '616', name: 'Sin obligaciones fiscales', appliesTo: ['FISICA'] },
  {
    code: '620',
    name: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
    appliesTo: ['MORAL'],
  },
  { code: '621', name: 'Incorporación Fiscal', appliesTo: ['FISICA'] },
  {
    code: '622',
    name: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    appliesTo: ['MORAL'],
  },
  {
    code: '623',
    name: 'Opcional para Grupos de Sociedades',
    appliesTo: ['MORAL'],
  },
  { code: '624', name: 'Coordinados', appliesTo: ['MORAL'] },
  {
    code: '625',
    name: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    appliesTo: ['FISICA'],
  },
  {
    code: '626',
    name: 'Régimen Simplificado de Confianza',
    appliesTo: ['FISICA', 'MORAL'],
  },
];

export interface CfdiUse {
  code: string;
  name: string;
  appliesTo: PersonType[];
}

// c_UsoCFDI (los que aplican a servicios de hospedaje)
export const CFDI_USES: CfdiUse[] = [
  { code: 'G03', name: 'Gastos en general', appliesTo: ['FISICA', 'MORAL'] },
  {
    code: 'G01',
    name: 'Adquisición de mercancías',
    appliesTo: ['FISICA', 'MORAL'],
  },
  { code: 'S01', name: 'Sin efectos fiscales', appliesTo: ['FISICA', 'MORAL'] },
];

/** RFC genéricos: público en general y residentes en el extranjero. */
export const GENERIC_RFCS = ['XAXX010101000', 'XEXX010101000'] as const;

// 3 letras (moral) o 4 (física), fecha AAMMDD y homoclave de 3 caracteres.
const RFC_PATTERN =
  /^([A-ZÑ&]{3,4})(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([A-Z\d]{2})([A\d])$/;

export function normalizeRfc(rfc: string): string {
  return rfc.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidRfc(rfc: string): boolean {
  return RFC_PATTERN.test(normalizeRfc(rfc));
}

/** 13 caracteres = persona física; 12 = persona moral. */
export function personTypeOf(rfc: string): PersonType {
  return normalizeRfc(rfc).length === 13 ? 'FISICA' : 'MORAL';
}

export function isGenericRfc(rfc: string): boolean {
  return (GENERIC_RFCS as readonly string[]).includes(normalizeRfc(rfc));
}

/**
 * Valida un perfil fiscal contra las reglas de CFDI 4.0. Devuelve los
 * mensajes de error (vacío si es válido).
 */
export function validateTaxProfile(profile: {
  rfc: string;
  taxRegime: string;
  cfdiUse: string;
}): string[] {
  const errors: string[] = [];
  const rfc = normalizeRfc(profile.rfc);

  if (!isValidRfc(rfc)) {
    errors.push(
      'El RFC no es válido: deben ser 12 caracteres (persona moral) o 13 (persona física)',
    );
    return errors;
  }

  const regime = TAX_REGIMES.find((r) => r.code === profile.taxRegime);
  const use = CFDI_USES.find((u) => u.code === profile.cfdiUse);
  if (!regime) errors.push('El régimen fiscal no es válido');
  if (!use) errors.push('El uso de CFDI no es válido');
  if (!regime || !use) return errors;

  // Los RFC genéricos solo admiten "Sin obligaciones fiscales" y "Sin efectos fiscales".
  if (isGenericRfc(rfc)) {
    if (regime.code !== '616' || use.code !== 'S01') {
      errors.push(
        'Con un RFC genérico el régimen debe ser 616 (Sin obligaciones fiscales) y el uso S01 (Sin efectos fiscales)',
      );
    }
    return errors;
  }

  const person = personTypeOf(rfc);
  const label = person === 'FISICA' ? 'persona física' : 'persona moral';
  if (!regime.appliesTo.includes(person)) {
    errors.push(`El régimen ${regime.code} no aplica a una ${label}`);
  }
  if (!use.appliesTo.includes(person)) {
    errors.push(`El uso de CFDI ${use.code} no aplica a una ${label}`);
  }
  return errors;
}
