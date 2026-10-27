import { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserAvatar } from '@/components/user-avatar';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthorizers } from '../billing-api';
import type { Authorization } from '../types';

export function AuthorizationDialog({
  request,
  onDone,
}: {
  request: {
    reason: string;
    action: (authorization: Authorization) => Promise<unknown>;
  } | null;
  onDone: (ok: boolean) => void;
}) {
  return (
    <Dialog open={!!request} onOpenChange={(open) => !open && onDone(false)}>
      <DialogContent className="sm:max-w-sm">
        {request && <AuthorizationForm request={request} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function AuthorizationForm({
  request,
  onDone,
}: {
  request: {
    reason: string;
    action: (authorization: Authorization) => Promise<unknown>;
  };
  onDone: (ok: boolean) => void;
}) {
  const { data: authorizers, isLoading } = useAuthorizers(true);
  const [authorizerId, setAuthorizerId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!authorizerId) return setError('Elige quién autoriza');
    if (!/^\d{4,6}$/.test(pin))
      return setError('El PIN tiene de 4 a 6 dígitos');
    setBusy(true);
    setError(null);
    try {
      await request.action({ authorizerId, pin });
      onDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="mb-2 grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <ShieldCheck className="size-5" />
        </div>
        <DialogTitle>Autorización requerida</DialogTitle>
        <DialogDescription>
          {request.reason}. Pide a quien autoriza que escriba su PIN.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>¿Quién autoriza?</Label>
          {isLoading && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
          {authorizers?.length === 0 && (
            <p className="text-sm text-destructive">
              Nadie tiene permiso para autorizar. Un administrador debe
              activarlo en Usuarios.
            </p>
          )}
          <div className="space-y-1.5">
            {authorizers?.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={!a.hasPin}
                onClick={() => setAuthorizerId(a.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-muted',
                  authorizerId === a.id &&
                    'border-primary bg-primary/5 ring-2 ring-primary/20',
                  !a.hasPin &&
                    'cursor-not-allowed opacity-50 hover:bg-transparent',
                )}
              >
                <UserAvatar name={a.name} className="size-8" />
                <span className="flex-1 text-sm font-medium">{a.name}</span>
                {!a.hasPin && (
                  <span className="text-xs text-muted-foreground">Sin PIN</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="auth-pin">PIN</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="auth-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="pl-9 text-center font-mono text-lg tracking-[0.5em]"
              aria-invalid={!!error}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onDone(false)}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Autorizar
        </Button>
      </DialogFooter>
    </>
  );
}
