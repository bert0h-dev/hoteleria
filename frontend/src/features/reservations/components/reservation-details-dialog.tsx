import { useState } from 'react';
import {
  ArrowUpCircle,
  BedDouble,
  CalendarPlus,
  DoorOpen,
  Printer,
  Repeat,
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
import { Link } from 'react-router';
import { formatDateTime, formatDayTime } from '@/lib/format';
import {
  useCancelReservation,
  useNoShow,
  useReservation,
} from '../reservations-api';
import { MODALITIES, SOURCES, unitLabel, type Reservation } from '../types';
import { PriceSummary } from './price-summary';
import { ReservationFormDialog } from './reservation-form-dialog';
import { FolioPanel } from '@/features/billing/components/folio-panel';
import { cn } from '@/lib/utils';
import { ReservationStatusBadge } from './reservation-status-badge';
import {
  CheckInDialog,
  CheckOutDialog,
  ExtendStayDialog,
  GuestsDialog,
  MoveRoomDialog,
} from './stay-dialogs';

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
  const [stayAction, setStayAction] = useState<
    'check-in' | 'check-out' | 'extend' | 'move' | 'guests' | null
  >(null);
  const isInHouse = r.status === 'CHECKED_IN';
  const [tab, setTab] = useState<'detail' | 'folio'>('detail');
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
    {
      icon: LogIn,
      label: r.checkedInAt ? 'Entró' : 'Entrada',
      value: r.checkedInAt
        ? `${formatDayTime(r.checkedInAt)} · ${r.checkedInBy?.name ?? ''}`
        : formatDayTime(r.checkIn),
    },
    {
      icon: LogOut,
      label: r.checkedOutAt ? 'Salió' : 'Salida',
      value: r.checkedOutAt
        ? `${formatDayTime(r.checkedOutAt)} · ${r.checkedOutBy?.name ?? ''}`
        : formatDayTime(r.checkOut),
    },
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
          {(isInHouse || r.status === 'CHECKED_OUT') && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                render={
                  <Link to={`/reservas/${r.id}/registro`} target="_blank" />
                }
              >
                <Printer />
                Tarjeta
              </Button>
              {isInHouse && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStayAction('guests')}
                  >
                    <Users />
                    Personas
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStayAction('extend')}
                  >
                    <CalendarPlus />
                    Extender
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStayAction('move')}
                  >
                    <Repeat />
                    Cambiar
                  </Button>
                  <Button size="sm" onClick={() => setStayAction('check-out')}>
                    <LogOut />
                    Check-out
                  </Button>
                </>
              )}
            </div>
          )}
          {isConfirmed && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setStayAction('check-in')}>
                <DoorOpen />
                Check-in
              </Button>
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

      <nav className="flex shrink-0 gap-1 border-b px-6">
        {(
          [
            { id: 'detail', label: 'Detalle' },
            { id: 'folio', label: 'Cuenta' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              '-mb-px border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground',
              tab === t.id && 'border-primary text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'folio' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <FolioPanel reservationId={r.id} />
        </div>
      ) : (
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

            {r.bookedRoomType && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-violet-700 dark:text-violet-300">
                  <ArrowUpCircle className="size-4" />
                  Mejora de categoría: {r.bookedRoomType.name} →{' '}
                  {r.roomType.name}
                </p>
                <p className="text-muted-foreground">{r.upgradeReason}</p>
              </div>
            )}

            {r.charges.some((c) => c.status === 'SUGGESTED') && (
              <button
                type="button"
                onClick={() => setTab('folio')}
                className="w-full rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-left text-sm hover:bg-amber-500/10"
              >
                Hay cargos sugeridos por cobrar o condonar · ver la cuenta →
              </button>
            )}

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
      )}

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
      <CheckInDialog
        reservation={stayAction === 'check-in' ? r : null}
        onOpenChange={(o) => !o && setStayAction(null)}
      />
      <CheckOutDialog
        reservation={stayAction === 'check-out' ? r : null}
        onOpenChange={(o) => !o && setStayAction(null)}
      />
      <ExtendStayDialog
        reservation={stayAction === 'extend' ? r : null}
        onOpenChange={(o) => !o && setStayAction(null)}
      />
      <GuestsDialog
        reservation={stayAction === 'guests' ? r : null}
        onOpenChange={(o) => !o && setStayAction(null)}
      />
      <MoveRoomDialog
        reservation={stayAction === 'move' ? r : null}
        onOpenChange={(o) => !o && setStayAction(null)}
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
