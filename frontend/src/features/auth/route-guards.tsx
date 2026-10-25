import { Navigate, Outlet, useLocation } from 'react-router';
import { FullScreenLoader } from '@/components/full-screen-loader';
import { ForbiddenPage } from '@/pages/forbidden-page';
import { useAuth } from './auth-context';
import type { Role } from './types';

/** Solo deja pasar con sesión iniciada; si no, manda al login. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** Solo para quien no ha iniciado sesión (p. ej. el login). */
export function GuestOnly() {
  const { status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Limita una sección a ciertos roles. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { hasRole } = useAuth();
  return hasRole(...roles) ? <Outlet /> : <ForbiddenPage />;
}
