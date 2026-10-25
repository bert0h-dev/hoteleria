import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

/** Cliente HTTP para la API del backend. */
export const api = axios.create({ baseURL, withCredentials: true });

// Cliente sin interceptores, para renovar la sesión sin caer en bucles.
const authClient = axios.create({ baseURL, withCredentials: true });

// El access token vive solo en memoria (nunca en localStorage).
let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;
let refreshInFlight: Promise<RefreshResult | null> | null = null;

export interface RefreshResult<TUser = unknown> {
  accessToken: string;
  user: TUser;
}

export const session = {
  setToken(token: string | null) {
    accessToken = token;
  },
  /** Se llama cuando la sesión ya no se puede renovar. */
  onExpired(handler: () => void) {
    onSessionExpired = handler;
  },
  /**
   * Renueva la sesión con la cookie del refresh token. Si varias peticiones
   * lo piden a la vez, comparten la misma llamada: el backend rota el token
   * y un segundo uso cerraría todas las sesiones del usuario.
   */
  refresh<TUser>(): Promise<RefreshResult<TUser> | null> {
    refreshInFlight ??= authClient
      .post<RefreshResult>('/auth/refresh')
      .then(({ data }) => {
        accessToken = data.accessToken;
        return data;
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight as Promise<RefreshResult<TUser> | null>;
  },
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as
    (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthRoute = original?.url?.startsWith('/auth/');

  if (
    error.response?.status !== 401 ||
    !original ||
    original._retried ||
    isAuthRoute
  ) {
    throw error;
  }

  original._retried = true;
  const renewed = await session.refresh();
  if (!renewed) {
    onSessionExpired?.();
    throw error;
  }
  return api(original);
});

/** Extrae un mensaje legible (en español) de un error de la API. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión.';
    }
    const message = (error.response.data as { message?: string | string[] })
      ?.message;
    if (Array.isArray(message)) return message[0] ?? 'Datos no válidos';
    if (message) return message;
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
