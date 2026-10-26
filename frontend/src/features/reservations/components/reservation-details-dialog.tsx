import { useState } from 'react';
import {
  BedDouble,
  CircleSlash,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  Megaphone,
  Pencil,
  StickyNote,
  UserX,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { GuestBadges } from '@/features/guests/components/guest-badges';
import { getErrorMessage } from '@/lib/api';
import { formatDateTime, formatDayTime } from '@/lib/format';
import {
  useCancelReservation,
  useNoShow,
  useReservation,
} from '../reservations-api';
import { MODALITIES, SOURCES, unitLabel, type Reservation } from '../types';
import { PriceSummary } from './price-summary';
import { ReservationFormDialog } from './reservation-form-dialog';
import { ReservationStatusBadge } from './reservation-status-badge';

export function ReservationDetailsDialog({
  reservationId,
  onOpenChange,
}: {
  reservationId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useReservation(reservationId);

  return (
    <Dialog open={!!reservationId} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {isLoading || !data ? (
          <div className="space-y-4 p-6">
            <DialogTitle className="sr-only">Cargando reserva</DialogTitle>
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Details reservation={data} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Details({ reservation: r }: { reservation: Reservation }) {
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const noShow = useNoShow();
  const isConfirmed = r.status === 'CONFIRMED';
  // Se toma la hora al abrir el detalle (no en cada render).
  const [openedAt] = useState(() => Date.now());
  const arrivalPassed = new Date(r.checkIn).getTime() <= openedAt;
  const guestName = `${r.guest.firstName} ${r.guest.lastName}`;

  const markNoShow = async () => {
    try {
      await noShow.mutateAsync(r.id);
      toast.success(`Reserva ${r.code}: no se presentó`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const facts = [
    { icon: LogIn, label: 'Entrada', value: formatDayTime(r.checkIn) },
    { icon: LogOut, label: 'Salida', value: formatDayTime(r.checkOut) },
    {
      icon: BedDouble,
      label: 'Habitación',
      value: `${r.roomType.name} · ${r.room ? `#${r.room.number}` : 'se asigna al llegar'}`,
    },
    {
      icon: Users,
      label: 'Personas',
      value: `${r.adults} ${r.adults === 1 ? 'adulto' : 'adultos'}${
        r.children
          ? ` · ${r.children} ${r.children === 1 ? 'niño' : 'niños'}`
          : ''
      }`,
    },
    { icon: Megaphone, label: 'Origen', value: SOURCES[r.source] },
    {
      icon: Wallet,
      label: 'Anticipo',
      value: r.requiresDeposit ? 'Requiere anticipo' : 'No requiere',
    },
    {
      icon: FileText,
      label: 'Facturar a',
      value: r.taxProfile
        ? `${r.taxProfile.rfc} · ${r.taxProfile.legalName}`
        : 'Sin factura',
    },
  ];

  return (
    <>
      <DialogHeader className="shrink-0 border-b p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <DialogTitle className="flex items-center gap-2 font-mono text-lg">
              {r.code}
              <ReservationStatusBadge status={r.status} className="font-sans" />
            </DialogTitle>
            <DialogDescription>
              {MODALITIES[r.modality].label} · {unitLabel(r.modality, r.units)}{' '}
              · creada por {r.createdBy.name} el {formatDateTime(r.createdAt)}
            </DialogDescription>
          </div>
          {isConfirmed && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <Pencil />
                Modificar
              </Button>
              {arrivalPassed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={markNoShow}
                  disabled={noShow.isPending}
                >
                  {noShow.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <UserX />
                  )}
                  No se presentó
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setCancelling(true)}
              >
                <CircleSlash />
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <UserAvatar name={guestName} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {guestName}
                <GuestBadges guest={r.guest} />
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {[r.guest.phone, r.guest.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          {r.status === 'CANCELLED' && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm">
              <p className="font-medium text-rose-700 dark:text-rose-300">
                Cancelada por {r.cancelledBy?.name} el{' '}
                {r.cancelledAt && formatDateTime(r.cancelledAt)}
              </p>
              <p className="text-muted-foreground">{r.cancelReason}</p>
            </div>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5" />
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-medium break-words">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {r.notes && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <StickyNote className="size-3.5" />
                Notas
              </p>
              <p className="mt-1 text-sm whitespace-pre-line">{r.notes}</p>
            </div>
          )}
        </div>

        <div className="border-t bg-muted/20 p-6 md:border-t-0 md:border-l">
          <h3 className="mb-3 text-sm font-semibold">
            Precio (congelado al reservar)
          </h3>
          <PriceSummary
            modality={r.modality}
            baseAmount={r.baseAmount}
            extrasAmount={r.extrasAmount}
            totalAmount={r.totalAmount}
            detail={r.pricing}
          />
        </div>
      </div>

      <ReservationFormDialog
        open={editing}
        onOpenChange={setEditing}
        reservation={r}
      />
      <CancelDialog
        reservation={r}
        open={cancelling}
        onOpenChange={setCancelling}
      />
    </>
  );
}

function CancelDialog({
  reservation,
  open,
  onOpenChange,
}: {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancel = useCancelReservation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason.trim()) {
      setError('Escribe el motivo de la cancelación');
      return;
    }
    try {
      await cancel.mutateAsync({ id: reservation.id, reason: reason.trim() });
      toast.success(`Reserva ${reservation.code} cancelada`);
      setReason('');
      setError(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Cancelar la reserva {reservation.code}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            La habitación quedará disponible otra vez para esas fechas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Motivo</Label>
          <Textarea
            id="cancel-reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. el huésped canceló por teléfono"
            aria-invalid={!!error}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={cancel.isPending}
          >
            {cancel.isPending && <Loader2 className="animate-spin" />}
            Cancelar reserva
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
