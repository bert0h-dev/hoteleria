/**
 * Búsqueda de huéspedes sin acentos ni mayúsculas. Cada huésped guarda un
 * `searchText` normalizado; la búsqueda exige que cada palabra escrita
 * aparezca en él (en cualquier orden).
 */

/** "José ÑÚÑEZ" → "jose nunez". */
export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Solo los dígitos de un teléfono: "(998) 123-4567" → "9981234567". */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export interface SearchableGuest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
  rfcs?: string[];
}

export function buildSearchText(guest: SearchableGuest): string {
  return normalizeForSearch(
    [
      guest.firstName,
      guest.lastName,
      guest.email,
      guest.phone && phoneDigits(guest.phone),
      guest.documentNumber,
      ...(guest.rfcs ?? []),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/**
 * Palabras de la búsqueda. Si la búsqueda parece un teléfono, se usan solo
 * sus dígitos para que "998 123 4567" encuentre "9981234567".
 */
export function searchTerms(query: string): string[] {
  const trimmed = query.trim();
  if (/^[\d\s()+-]{7,}$/.test(trimmed)) return [phoneDigits(trimmed)];
  return normalizeForSearch(trimmed).split(' ').filter(Boolean);
}
