import { useState } from 'react';
import { DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { useAuth } from '@/features/auth/auth-context';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSetTodayRate, useTodayRate } from '../billing-api';

const DISMISS_KEY = 'hoteleria-rate-dismissed';

function dismissedToday(date: string) {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === date;
  } catch {
    return false;
  }
}

/**
 * Indicador del tipo de cambio en el encabezado. Si es el primero en entrar
 * en el día y no hay tipo de cambio capturado, abre la ventana para capturarlo
 * (se puede posponer; sin él no se aceptan dólares).
 */
export function ExchangeRateIndicator() {
  const { hasRole } = useAuth();
  const allowed = hasRole('ADMIN', 'RECEPTION');
  const { data: today } = useTodayRate(allowed);
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!allowed || !today) return null;
  const autoOpen =
    today.rate === null &&
    dismissed !== today.date &&
    !dismissedToday(today.date);

  const close = () => {
    setManualOpen(false);
    if (today.rate === null) {
      try {
        sessionStorage.setItem(DISMISS_KEY, today.date);
      } catch {
        // Sin almacenamiento: se pospone solo en esta vista.
      }
      setDismissed(today.date);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setManualOpen(true)}
        className={cn(
          'hidden items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-muted sm:inline-flex',
          today.rate === null &&
            'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        )}
        title="Tipo de cambio de hoy"
      >
        <DollarSign className="size-3.5" />
        {today.rate === null
          ? 'Sin tipo de cambio'
          : `TC ${today.rate.toFixed(4)}`}
      </button>
      <Dialog open={manualOpen || autoOpen} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-sm">
          {(manualOpen || autoOpen) && (
            <RateForm current={today.rate} onDone={close} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RateForm({
  current,
  onDone,
}: {
  current: number | null;
  onDone: () => void;
}) {
  const { hasRole } = useAuth();
  const save = useSetTodayRate();
  const [value, setValue] = useState(current ? String(current) : '');
  const canEdit = current === null || hasRole('ADMIN');

  const submit = async () => {
    const rate = Number(value.replace(',', '.'));
    if (!Number.isFinite(rate) || rate <= 0)
      return toast.error('Escribe un tipo de cambio válido');
    try {
      await save.mutateAsync(Math.round(rate * 10_000) / 10_000);
      toast.success(`Tipo de cambio de hoy: $${rate.toFixed(4)} por dólar`);
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="mb-2 grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <DollarSign className="size-5" />
        </div>
        <DialogTitle>Tipo de cambio de hoy</DialogTitle>
        <DialogDescription>
          {current === null
            ? 'Aún no se captura el de hoy. Sin él no se pueden recibir pagos en dólares.'
            : canEdit
              ? 'Puedes corregirlo como administrador.'
              : 'Ya se capturó hoy; solo un administrador puede corregirlo.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="rate">Pesos por dólar</Label>
        <Input
          id="rate"
          inputMode="decimal"
          autoFocus
          disabled={!canEdit}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canEdit && submit()}
          placeholder="17.2500"
          className="h-12 text-2xl font-semibold tabular-nums"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          {current === null ? 'Más tarde' : 'Cerrar'}
        </Button>
        {canEdit && (
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Guardar
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
