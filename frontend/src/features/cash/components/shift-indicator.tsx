import { useState } from 'react';
import { Link } from 'react-router';
import { Wallet } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { formatCents } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCurrentShift } from '../cash-api';
import { OpenShiftDialog } from './shift-dialogs';

/**
 * Estado de mi caja en el encabezado: abierta (lleva a Caja) o cerrada
 * (abre la ventana para iniciar turno).
 */
export function ShiftIndicator() {
  const { hasRole } = useAuth();
  const allowed = hasRole('ADMIN', 'RECEPTION');
  const { data: shift, isLoading } = useCurrentShift(allowed);
  const [open, setOpen] = useState(false);

  if (!allowed || isLoading) return null;
  const className =
    'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-muted';

  if (shift) {
    return (
      <Link
        to="/caja"
        className={cn(className, 'text-emerald-700 dark:text-emerald-300')}
        title="Mi turno de caja"
      >
        <Wallet className="size-3.5" />
        <span className="hidden sm:inline">
          Caja · {formatCents(shift.totals?.netMxnCents ?? 0)}
        </span>
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          className,
          'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        )}
        title="Abre tu turno para poder cobrar"
      >
        <Wallet className="size-3.5" />
        <span className="hidden sm:inline">Caja cerrada</span>
      </button>
      <OpenShiftDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
