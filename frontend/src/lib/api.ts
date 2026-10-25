import axios from 'axios';

/** Cliente HTTP para la API del backend. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api',
  withCredentials: true,
});
