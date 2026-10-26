// Nombres de países en español a partir de su código ISO (MX, US…).
const regionNames = new Intl.DisplayNames(['es'], { type: 'region' });

export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Bandera emoji a partir del código ISO: "MX" → 🇲🇽. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(
    ...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

// Países más frecuentes primero; después, el resto en orden alfabético.
const FREQUENT = ['MX', 'US', 'CA', 'ES', 'CO', 'AR', 'GT', 'CL', 'PE'];
const OTHERS = [
  'AD',
  'AE',
  'AT',
  'AU',
  'BE',
  'BO',
  'BR',
  'BZ',
  'CH',
  'CN',
  'CR',
  'CU',
  'CZ',
  'DE',
  'DK',
  'DO',
  'EC',
  'EG',
  'FI',
  'FR',
  'GB',
  'GR',
  'HN',
  'HU',
  'IE',
  'IL',
  'IN',
  'IT',
  'JM',
  'JP',
  'KR',
  'MA',
  'NI',
  'NL',
  'NO',
  'NZ',
  'PA',
  'PH',
  'PL',
  'PR',
  'PT',
  'PY',
  'RO',
  'RU',
  'SE',
  'SG',
  'SV',
  'TH',
  'TR',
  'TW',
  'UA',
  'UY',
  'VE',
  'VN',
  'ZA',
];

export const COUNTRY_OPTIONS = [
  ...FREQUENT,
  ...OTHERS.sort((a, b) => countryName(a).localeCompare(countryName(b), 'es')),
].map((code) => ({
  value: code,
  label: `${countryFlag(code)} ${countryName(code)}`,
}));
