import { useState } from 'react';
import { AxiosError } from 'axios';
import { AuthorizationDialog } from './components/authorization-dialog';
import type { Authorization } from './types';

/** ¿El servidor rechazó la operación porque falta autorización? */
export function needsAuthorization(error: unknown): string | null {
  if (error instanceof AxiosError && error.response?.status === 403) {
    const message = (error.response.data as { message?: string })?.message;
    if (
      typeof message === 'string' &&
      message.endsWith('requiere autorización')
    ) {
      return message;
    }
  }
  return null;
}

/**
 * Ejecuta una operación y, si el servidor pide autorización, abre el
 * diálogo (elegir quién autoriza + PIN) y la reintenta con ella.
 *
 *   const { run, dialog } = useAuthorizedAction();
 *   await run((authorization) => mutate({ ...input, authorization }));
 *   return <>{…}{dialog}</>;
 */
export function useAuthorizedAction() {
  const [pending, setPending] = useState<{
    reason: string;
    action: (authorization: Authorization) => Promise<unknown>;
    resolve: (ok: boolean) => void;
  } | null>(null);

  async function run<T>(
    action: (authorization?: Authorization) => Promise<T>,
  ): Promise<boolean> {
    try {
      await action();
      return true;
    } catch (error) {
      const reason = needsAuthorization(error);
      if (!reason) throw error;
      return new Promise<boolean>((resolve) =>
        setPending({ reason, action, resolve }),
      );
    }
  }

  const dialog = (
    <AuthorizationDialog
      request={pending}
      onDone={(ok) => {
        pending?.resolve(ok);
        setPending(null);
      }}
    />
  );
  return { run, dialog };
}
