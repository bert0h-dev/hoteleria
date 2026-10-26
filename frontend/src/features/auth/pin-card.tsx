import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSetPin } from '@/features/billing/billing-api';
import { api, getErrorMessage } from '@/lib/api';
import type { User } from './types';

/** PIN de autorización (solo para quien tiene permiso de autorizar). */
export function PinCard() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<User>('/auth/me')).data,
  });
  const setPin = useSetPin();
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\d{4,6}$/.test(pin))
      return setError('El PIN debe tener de 4 a 6 dígitos');
    if (pin !== confirm) return setError('Los PIN no coinciden');
    if (!password) return setError('Escribe tu contraseña actual');
    setError(null);
    try {
      await setPin.mutateAsync({ currentPassword: password, pin });
      toast.success(me?.hasAuthPin ? 'PIN actualizado' : 'PIN configurado');
      setPinValue('');
      setConfirm('');
      setPassword('');
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['authorizers'] });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          PIN de autorización
        </CardTitle>
        <CardDescription>
          Con él autorizas descuentos sobre el tope, condonaciones y salidas con
          saldo pendiente.{' '}
          {me?.hasAuthPin ? (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
              <Check className="size-3.5" /> Ya tienes PIN.
            </span>
          ) : (
            <b className="text-amber-600">Aún no lo configuras.</b>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">
              {me?.hasAuthPin ? 'Nuevo PIN' : 'PIN'}
            </Label>
            <Input
              id="new-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPinValue(digits(e.target.value))}
              className="text-center font-mono tracking-[0.4em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pin">Confirmar</Label>
            <Input
              id="confirm-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(digits(e.target.value))}
              className="text-center font-mono tracking-[0.4em]"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pin-password">Tu contraseña actual</Label>
          <Input
            id="pin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="mt-6 justify-end border-t pt-6">
        <Button onClick={submit} disabled={setPin.isPending}>
          {setPin.isPending && <Loader2 className="animate-spin" />}
          {me?.hasAuthPin ? 'Cambiar PIN' : 'Guardar PIN'}
        </Button>
      </CardFooter>
    </Card>
  );
}
