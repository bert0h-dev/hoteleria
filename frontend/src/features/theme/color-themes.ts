import { useSyncExternalStore } from 'react';

// Los colores de cada tema viven en src/styles/themes.css (generado con
// `npm run themes`). Aquí solo están los nombres que ve el usuario.
export const COLOR_THEMES = [
  { id: 'indigo', label: 'Índigo', description: 'Moderno y tecnológico' },
  { id: 'emerald', label: 'Esmeralda', description: 'Fresco, hotel boutique' },
  { id: 'ruby', label: 'Rubí', description: 'Elegante e intenso' },
  { id: 'ocean', label: 'Océano', description: 'Calmado, de playa' },
  { id: 'graphite', label: 'Grafito', description: 'Sobrio y ejecutivo' },
  { id: 'amber', label: 'Ámbar', description: 'Cálido, de hacienda' },
  { id: 'orchid', label: 'Orquídea', description: 'Lujo y spa' },
  { id: 'midnight', label: 'Medianoche', description: 'Premium con dorado' },
] as const;

export type ColorThemeId = (typeof COLOR_THEMES)[number]['id'];

// Debe coincidir con el script de index.html que aplica el tema al cargar.
const STORAGE_KEY = 'hoteleria-color-theme';
const DEFAULT_THEME: ColorThemeId = 'indigo';

const listeners = new Set<() => void>();

function isColorTheme(value: unknown): value is ColorThemeId {
  return COLOR_THEMES.some((t) => t.id === value);
}

function getColorTheme(): ColorThemeId {
  const current = document.documentElement.dataset.theme;
  return isColorTheme(current) ? current : DEFAULT_THEME;
}

export function setColorTheme(id: ColorThemeId) {
  const root = document.documentElement;
  // Activa una transición suave solo durante el cambio.
  root.classList.add('theme-transition');
  root.dataset.theme = id;
  window.setTimeout(() => root.classList.remove('theme-transition'), 450);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Navegación privada o almacenamiento bloqueado: solo dura la sesión.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useColorTheme() {
  const theme = useSyncExternalStore(subscribe, getColorTheme);
  return { theme, setTheme: setColorTheme };
}
