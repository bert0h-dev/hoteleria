import { useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  CalendarPlus,
  DoorOpen,
  IdCard,
  Loader2,
  LogOut,
  Printer,
  Repeat,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
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
import { GuestBadges } from '@/features/guests/components/guest-badges';
import { useGuest } from '@/features/guests/guests-api';
import { getErrorMessage } from '@/lib/api';
import {
  addDays,
  formatCents,
  formatDayTime,
  formatMoney,
  todayInHotel,
} from '@/lib/format';
import {
  useAvailableRooms,
  useChangeGuests,
  useCheckIn,
  useCheckOut,
  useExtendStay,
  useMoveRoom,
} from '../reservations-api';
import { MODALITIES, unitLabel, type Reservation } from '../types';
import { GuestCountStepper } from './guest-count-stepper';
import { RoomPicker } from './room-picker';
import { useFolio } from '@/features/billing/billing-api';
import { PaymentDialog } from '@/features/billing/components/folio-dialogs';
import { useAuthorizedAction } from '@/features/billing/use-authorized-action';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type DialogProps = {
  reservation: Reservation | null;
  onOpenChange: (open: boolean) => void;
};

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export function CheckInDialog({ reservation, onOpenChange }: DialogProps) {
  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        {reservation && (
          <CheckInForm
            reservation={reservation}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckInForm({
  reservation: r,
  onDone,
}: {
  reservation: Reservation;
  onDone: () => void;
}) {
  const rooms = useAvailableRooms(r.id);
  const { data: guest } = useGuest(r.guestId);
  const checkIn = useCheckIn();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [done, setDone] = useState<Reservation | null>(null);
  // Personas que llegan (pueden ser más o menos que las reservadas).
  const [guests, setGuests] = useState({
    adults: r.adults,
    children: r.children,
  });
  const guestsChanged =
    guests.adults !== r.adults || guests.children !== r.children;
  const name = `${r.guest.firstName} ${r.guest.lastName}`;

  const missing = [
    !guest?.documentType && 'identificación',
    !guest?.privacyAcceptedAt && 'aceptación del aviso de privacidad',
  ].filter(Boolean);

  const submit = async () => {
    const room = rooms.data?.find((x) => x.id === roomId);
    if (!room) return;
    if (room.upgrade && !reason.trim()) {
      setReasonError('Escribe el motivo de la mejora de categoría');
      return;
    }
    try {
      const updated = await checkIn.mutateAsync({
        id: r.id,
        roomId: room.id,
        reason: room.upgrade ? reason.trim() : undefined,
        ...(guestsChanged && guests),
      });
      toast.success(`Check-in: ${name} en la habitación ${room.number}`, {
        description: guestsChanged
          ? `Personas ajustadas; nuevo total ${formatMoney(updated.totalAmount)} (antes ${formatMoney(r.totalAmount)}).`
          : undefined,
      });
      setDone(updated);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Paso final: check-in hecho, ofrecer la tarjeta de registro.
  if (done) {
    const early = done.charges.find((c) => c.kind === 'EARLY_CHECK_IN');
    return (
      <>
        <DialogHeader>
          <DialogTitle>¡Bienvenido, {r.guest.firstName}!</DialogTitle>
          <DialogDescription>
            Habitación <b>{done.room?.number}</b> · salida{' '}
            {formatDayTime(done.checkOut)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600">
            <DoorOpen className="size-8" />
          </div>
          <p className="text-4xl font-bold tabular-nums">{done.room?.number}</p>
          {early && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Entrada anticipada: cargo sugerido de {formatMoney(early.amount)}{' '}
              ({early.hours} h), se cobra en Cobros.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Cerrar
          </Button>
          <Button
            render={
              <Link to={`/reservas/${done.id}/registro`} target="_blank" />
            }
          >
            <Printer />
            Imprimir tarjeta de registro
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Check-in · {r.code}</DialogTitle>
        <DialogDescription>
          Elige una habitación limpia para el huésped.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border p-3">
          <UserAvatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {name}
              <GuestBadges guest={r.guest} />
            </p>
            <p className="text-sm text-muted-foreground">
              {r.roomType.name} · {MODALITIES[r.modality].label.toLowerCase()} ·{' '}
              {unitLabel(r.modality, r.units)} · salida{' '}
              {formatDayTime(r.checkOut)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>¿Cuántas personas llegan?</Label>
          <GuestCountStepper value={guests} onChange={setGuests} />
          {guestsChanged && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Reservaron para {r.adults} adultos
              {r.children ? ` y ${r.children} niños` : ''}; el total se
              recalculará con los cargos por persona extra.
            </p>
          )}
        </div>

        {guest && missing.length > 0 && (
          <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <IdCard className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <p>
              Falta registrar: <b>{missing.join(' y ')}</b>. Puedes completarlo
              desde la ficha del huésped; también aparece en la tarjeta de
              registro para que la llene a mano.
            </p>
          </div>
        )}

        <RoomPicker
          rooms={rooms.data}
          isLoading={rooms.isLoading}
          value={roomId}
          onChange={(id) => {
            setRoomId(id);
            setReasonError(null);
          }}
          reason={reason}
          onReasonChange={setReason}
          reasonError={reasonError}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={!roomId || checkIn.isPending}>
          {checkIn.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <DoorOpen />
          )}
          Hacer check-in
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cambio de habitación
// ---------------------------------------------------------------------------

export function MoveRoomDialog({ reservation, onOpenChange }: DialogProps) {
  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        {reservation && (
          <MoveForm
            reservation={reservation}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveForm({
  reservation: r,
  onDone,
}: {
  reservation: Reservation;
  onDone: () => void;
}) {
  const rooms = useAvailableRooms(r.id);
  const move = useMoveRoom();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const submit = async () => {
    const room = rooms.data?.find((x) => x.id === roomId);
    if (!room) return;
    if (room.upgrade && !reason.trim()) {
      setReasonError('Escribe el motivo del cambio a otro tipo');
      return;
    }
    try {
      await move.mutateAsync({
        id: r.id,
        roomId: room.id,
        reason: reason.trim() || undefined,
      });
      toast.success(
        `${r.guest.firstName} pasó a la habitación ${room.number}`,
        {
          description: `La ${r.room?.number} quedó en limpieza.`,
        },
      );
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cambiar de habitación</DialogTitle>
        <DialogDescription>
          {r.guest.firstName} {r.guest.lastName} está en la{' '}
          <b>{r.room?.number}</b>; quedará en limpieza al cambiarlo.
        </DialogDescription>
      </DialogHeader>
      <RoomPicker
        rooms={rooms.data}
        isLoading={rooms.isLoading}
        value={roomId}
        onChange={(id) => {
          setRoomId(id);
          setReasonError(null);
        }}
        reason={reason}
        onReasonChange={setReason}
        reasonError={reasonError}
      />
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={!roomId || move.isPending}>
          {move.isPending ? <Loader2 className="animate-spin" /> : <Repeat />}
          Cambiar habitación
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Extender estancia
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Personas (durante la estancia o antes de llegar)
// ---------------------------------------------------------------------------

export function GuestsDialog({ reservation, onOpenChange }: DialogProps) {
  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {reservation && (
          <GuestsForm
            reservation={reservation}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GuestsForm({
  reservation: r,
  onDone,
}: {
  reservation: Reservation;
  onDone: () => void;
}) {
  const change = useChangeGuests();
  const [guests, setGuests] = useState({
    adults: r.adults,
    children: r.children,
  });
  const changed = guests.adults !== r.adults || guests.children !== r.children;

  const submit = async () => {
    try {
      const updated = await change.mutateAsync({ id: r.id, ...guests });
      toast.success('Personas actualizadas', {
        description: `Nuevo total ${formatMoney(updated.totalAmount)} (antes ${formatMoney(r.totalAmount)}).`,
      });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Personas · {r.code}</DialogTitle>
        <DialogDescription>
          {r.guest.firstName} {r.guest.lastName}
          {r.room && ` · habitación ${r.room.number}`}. Se recalcula toda la
          estancia con los cargos por persona extra.
        </DialogDescription>
      </DialogHeader>
      <GuestCountStepper value={guests} onChange={setGuests} />
      <p className="text-xs text-muted-foreground">
        Total actual: {formatMoney(r.totalAmount)}. La capacidad depende de la
        habitación asignada.
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={!changed || change.isPending}>
          {change.isPending ? <Loader2 className="animate-spin" /> : <Users />}
          Guardar
        </Button>
      </DialogFooter>
    </>
  );
}

export function ExtendStayDialog({ reservation, onOpenChange }: DialogProps) {
  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {reservation && (
          <ExtendForm
            reservation={reservation}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExtendForm({
  reservation: r,
  onDone,
}: {
  reservation: Reservation;
  onDone: () => void;
}) {
  const extend = useExtendStay();
  const nightly = r.modality === 'NIGHTLY';
  const currentDeparture = todayInHotel(new Date(r.checkOut));
  const [departureDate, setDepartureDate] = useState(
    addDays(currentDeparture, 1),
  );
  const [units, setUnits] = useState(r.units + 1);

  const submit = async () => {
    try {
      const updated = await extend.mutateAsync(
        nightly ? { id: r.id, departureDate } : { id: r.id, units },
      );
      toast.success('Estancia extendida', {
        description: `Nueva salida ${formatDayTime(updated.checkOut)} · total ${formatMoney(updated.totalAmount)} (antes ${formatMoney(r.totalAmount)})`,
      });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Extender estancia · {r.code}</DialogTitle>
        <DialogDescription>
          Salida actual: {formatDayTime(r.checkOut)} (
          {unitLabel(r.modality, r.units)}). El precio se recalcula con las
          tarifas y temporadas vigentes.
        </DialogDescription>
      </DialogHeader>
      {nightly ? (
        <div className="space-y-1.5">
          <Label htmlFor="extend-date">Nueva fecha de salida</Label>
          <Input
            id="extend-date"
            type="date"
            min={addDays(currentDeparture, 1)}
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="extend-units">
            Nueva duración total ({r.modality === 'DAILY' ? 'días' : 'horas'})
          </Label>
          <Input
            id="extend-units"
            type="number"
            min={r.units + 1}
            max={72}
            value={Number.isFinite(units) ? units : ''}
            onChange={(e) => setUnits(e.target.valueAsNumber)}
          />
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={extend.isPending}>
          {extend.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <CalendarPlus />
          )}
          Extender
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Check-out
// ---------------------------------------------------------------------------

export function CheckOutDialog({ reservation, onOpenChange }: DialogProps) {
  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {reservation && (
          <CheckOutForm
            reservation={reservation}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CheckOutForm({
  reservation: r,
  onDone,
}: {
  reservation: Reservation;
  onDone: () => void;
}) {
  const checkOut = useCheckOut();
  const { data: folio } = useFolio(r.id);
  const { run, dialog } = useAuthorizedAction();
  const [paying, setPaying] = useState(false);
  const [balanceReason, setBalanceReason] = useState('');
  // Hora al abrir el diálogo (no en cada render).
  const [openedAt] = useState(() => Date.now());
  const late = new Date(r.checkOut).getTime() < openedAt;
  const balance = folio?.totals.balanceCents ?? 0;
  const suggested =
    folio?.stayCharges.filter((c) => c.status === 'SUGGESTED') ?? [];

  const submit = async () => {
    if (balance > 0 && !balanceReason.trim()) {
      toast.error(
        'Hay saldo pendiente: cóbralo o indica el motivo para dejarlo pendiente',
      );
      return;
    }
    try {
      let updated: Reservation | null = null;
      const ok = await run(async (authorization) => {
        updated = await checkOut.mutateAsync({
          id: r.id,
          balanceReason: balance > 0 ? balanceReason.trim() : undefined,
          authorization,
        });
      });
      if (!ok || !updated) return;
      const charge = (updated as Reservation).charges.find(
        (c) => c.kind === 'LATE_CHECK_OUT',
      );
      toast.success(`Check-out de ${r.guest.firstName}`, {
        description: charge
          ? `Salida tardía: cargo sugerido de ${formatMoney(charge.amount)} (${charge.hours} h); cóbralo o condónalo en la cuenta. La ${r.room?.number} pasó a limpieza.`
          : `La habitación ${r.room?.number} pasó a limpieza.`,
      });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Check-out · habitación {r.room?.number}</DialogTitle>
        <DialogDescription>
          {r.guest.firstName} {r.guest.lastName} · {r.code}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between rounded-lg bg-muted/50 p-3">
          <span className="text-muted-foreground">Salida programada</span>
          <span className="font-medium">{formatDayTime(r.checkOut)}</span>
        </div>
        <div
          className={cn(
            'flex items-center justify-between rounded-lg p-3',
            balance > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
          )}
        >
          <div>
            <p className="text-muted-foreground">
              {balance > 0
                ? 'Saldo pendiente'
                : balance < 0
                  ? 'Saldo a favor'
                  : 'Cuenta pagada'}
            </p>
            <p className="text-xl font-bold tabular-nums">
              {folio ? formatCents(Math.abs(balance)) : '…'}
            </p>
          </div>
          {balance > 0 && (
            <Button size="sm" onClick={() => setPaying(true)}>
              <Wallet />
              Cobrar
            </Button>
          )}
        </div>
        {suggested.length > 0 && (
          <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Hay {suggested.length} cargo(s) sugerido(s) sin resolver; no están
            en el saldo. Puedes cobrarlos o condonarlos en la cuenta de la
            reserva.
          </p>
        )}
        {balance > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="balance-reason">
              Motivo para salir con saldo (cuenta por cobrar)
            </Label>
            <Textarea
              id="balance-reason"
              rows={2}
              maxLength={300}
              value={balanceReason}
              onChange={(e) => setBalanceReason(e.target.value)}
              placeholder="Ej. la empresa paga por transferencia"
            />
            <p className="text-xs text-muted-foreground">
              Requiere autorización con PIN si no puedes autorizar.
            </p>
          </div>
        )}
        {late && (
          <p className="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Sale después de su hora. Si pasa de la tolerancia, el sistema
            sugerirá un cargo por salida tardía.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          La habitación pasará automáticamente a limpieza.
        </p>
      </div>
      {folio && (
        <PaymentDialog folio={folio} open={paying} onOpenChange={setPaying} />
      )}
      {dialog}
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={checkOut.isPending}>
          {checkOut.isPending ? (
            <Loader2 className="animate-spin" />
          ) : (
            <LogOut />
          )}
          Hacer check-out
        </Button>
      </DialogFooter>
    </>
  );
}
