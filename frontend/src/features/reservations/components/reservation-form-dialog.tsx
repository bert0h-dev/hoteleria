import { useMemo, useState } from 'react';
import {
  Baby,
  BedDouble,
  CalendarRange,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  Minus,
  Moon,
  Plus,
  Sun,
  Users,
} from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { GuestPicker } from '@/features/guests/components/guest-picker';
import { useGuest } from '@/features/guests/guests-api';
import type { Guest } from '@/features/guests/types';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api';
import {
  addDays,
  formatDayTime,
  formatMoney,
  getHotelTimeZone,
  timeIn,
  todayInHotel,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { useQuote, useSaveReservation } from '../reservations-api';
import {
  MODALITIES,
  SOURCES,
  unitLabel,
  type Modality,
  type Reservation,
  type ReservationSource,
  type StayInput,
} from '../types';
import { PriceSummary } from './price-summary';

const NO_TAX = 'none';

const MODALITY_ICONS = { NIGHTLY: Moon, DAILY: Sun, HOURLY: Clock } as const;

export interface ReservationPreset {
  roomTypeId?: string;
  arrivalDate?: string;
}

interface FormState {
  modality: Modality;
  arrivalDate: string;
  departureDate: string;
  arrivalTime: string;
  units: number;
  adults: number;
  children: number;
  roomTypeId: string | null;
  guest: Guest | null;
  taxProfileId: string;
  source: ReservationSource;
  requiresDeposit: boolean;
  notes: string;
}

function initialState(
  reservation?: Reservation | null,
  preset?: ReservationPreset,
): FormState {
  const today = todayInHotel();
  if (reservation) {
    const tz = getHotelTimeZone();
    const checkIn = new Date(reservation.checkIn);
    return {
      modality: reservation.modality,
      arrivalDate: todayInHotel(checkIn),
      departureDate: todayInHotel(new Date(reservation.checkOut)),
      arrivalTime: timeIn(tz, checkIn),
      units: reservation.units,
      adults: reservation.adults,
      children: reservation.children,
      roomTypeId: reservation.roomTypeId,
      guest: reservation.guest as Guest,
      taxProfileId: reservation.taxProfileId ?? NO_TAX,
      source: reservation.source,
      requiresDeposit: reservation.requiresDeposit,
      notes: reservation.notes ?? '',
    };
  }
  const arrival =
    preset?.arrivalDate && preset.arrivalDate >= today
      ? preset.arrivalDate
      : today;
  return {
    modality: 'NIGHTLY',
    arrivalDate: arrival,
    departureDate: addDays(arrival, 1),
    arrivalTime: timeIn(getHotelTimeZone()).slice(0, 2) + ':00',
    units: 1,
    adults: 2,
    children: 0,
    roomTypeId: preset?.roomTypeId ?? null,
    guest: null,
    taxProfileId: NO_TAX,
    source: 'WALK_IN',
    requiresDeposit: false,
    notes: '',
  };
}

/** Datos de la estancia para cotizar, o null si aún están incompletos. */
function toStay(s: FormState): StayInput | null {
  const base = { modality: s.modality, adults: s.adults, children: s.children };
  if (!s.arrivalDate) return null;
  if (s.modality === 'NIGHTLY') {
    if (!s.departureDate || s.departureDate <= s.arrivalDate) return null;
    return {
      ...base,
      arrivalDate: s.arrivalDate,
      departureDate: s.departureDate,
    };
  }
  if (!s.arrivalTime || !Number.isInteger(s.units) || s.units < 1) return null;
  return {
    ...base,
    arrivalDate: s.arrivalDate,
    arrivalTime: s.arrivalTime,
    units: s.units,
  };
}

type FormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservation?: Reservation | null;
  preset?: ReservationPreset;
  onSaved?: (reservation: Reservation) => void;
};

/**
 * Nueva reserva o modificación. El formulario se monta cada vez que se abre
 * el diálogo, así siempre empieza con los datos correctos.
 */
export function ReservationFormDialog(props: FormProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex max-h-[94svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {props.open && <ReservationForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function ReservationForm({
  onOpenChange,
  reservation,
  preset,
  onSaved,
}: FormProps) {
  const isEdit = !!reservation;
  const [s, setS] = useState<FormState>(() =>
    initialState(reservation, preset),
  );
  const set = (patch: Partial<FormState>) =>
    setS((prev) => ({ ...prev, ...patch }));
  const save = useSaveReservation();

  // Cotización en vivo (con un pequeño retraso mientras se escribe).
  const stayKey = useDebouncedValue(JSON.stringify(toStay(s)), 300);
  const stay = useMemo(
    () => JSON.parse(stayKey) as StayInput | null,
    [stayKey],
  );
  const quote = useQuote(stay);
  const options = quote.data?.options ?? [];
  const selected = options.find((o) => o.roomType.id === s.roomTypeId);

  // Datos fiscales del huésped elegido.
  const { data: fullGuest } = useGuest(s.guest?.id);
  const taxItems = [
    { value: NO_TAX, label: 'Sin factura' },
    ...(fullGuest?.taxProfiles ?? []).map((p) => ({
      value: p.id,
      label: `${p.rfc} · ${p.legalName}`,
    })),
  ];

  // En edición la reserva actual ocupa un lugar; se cuenta como disponible.
  const availableFor = (typeId: string, available: number) =>
    isEdit && typeId === reservation.roomTypeId ? available + 1 : available;

  const canSave =
    !!stay &&
    !!selected &&
    !!s.guest &&
    selected.fitsGuests &&
    availableFor(selected.roomType.id, selected.available) > 0 &&
    !quote.isFetching;

  const submit = async () => {
    if (!stay || !selected || !s.guest) return;
    try {
      const saved = await save.mutateAsync({
        id: reservation?.id,
        ...stay,
        guestId: s.guest.id,
        roomTypeId: selected.roomType.id,
        source: s.source,
        requiresDeposit: s.requiresDeposit,
        notes: s.notes.trim() || null,
        taxProfileId: s.taxProfileId === NO_TAX ? null : s.taxProfileId,
      });
      toast.success(
        isEdit
          ? `Reserva ${saved.code} actualizada`
          : `Reserva ${saved.code} creada`,
        {
          description: `${s.guest.firstName} ${s.guest.lastName} · ${selected.roomType.name}`,
        },
      );
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const today = todayInHotel();
  const nights =
    s.modality === 'NIGHTLY' && s.departureDate > s.arrivalDate
      ? Math.round(
          (new Date(s.departureDate).getTime() -
            new Date(s.arrivalDate).getTime()) /
            86_400_000,
        )
      : 0;

  return (
    <>
      <DialogHeader className="shrink-0 border-b p-6">
        <DialogTitle>
          {isEdit ? `Modificar reserva ${reservation.code}` : 'Nueva reserva'}
        </DialogTitle>
        <DialogDescription>
          Se reserva un tipo de habitación; la habitación se asigna al llegar.
        </DialogDescription>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.15fr_1fr] lg:grid-rows-1 lg:overflow-hidden">
        {/* Izquierda: estancia y tipo */}
        <div className="min-h-0 space-y-6 p-6 lg:overflow-y-auto">
          <Section number={1} title="Estancia">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {(Object.keys(MODALITIES) as Modality[]).map((m) => {
                const Icon = MODALITY_ICONS[m];
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={s.modality === m}
                    onClick={() =>
                      set({ modality: m, units: m === 'HOURLY' ? 3 : 1 })
                    }
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground',
                      s.modality === m &&
                        'bg-background text-foreground shadow-sm',
                    )}
                  >
                    <Icon className="size-4" />
                    {MODALITIES[m].label}
                  </button>
                );
              })}
            </div>

            {s.modality === 'NIGHTLY' ? (
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-arrival">Llegada</Label>
                  <Input
                    id="r-arrival"
                    type="date"
                    min={isEdit ? undefined : today}
                    value={s.arrivalDate}
                    onChange={(e) => {
                      const arrivalDate = e.target.value;
                      set({
                        arrivalDate,
                        departureDate:
                          s.departureDate > arrivalDate
                            ? s.departureDate
                            : addDays(arrivalDate, Math.max(nights, 1)),
                      });
                    }}
                  />
                </div>
                <span className="mb-2 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-primary">
                  {nights ? unitLabel('NIGHTLY', nights) : '—'}
                </span>
                <div className="space-y-1.5">
                  <Label htmlFor="r-departure">Salida</Label>
                  <Input
                    id="r-departure"
                    type="date"
                    min={addDays(s.arrivalDate || today, 1)}
                    value={s.departureDate}
                    onChange={(e) => set({ departureDate: e.target.value })}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="r-date">Fecha</Label>
                  <Input
                    id="r-date"
                    type="date"
                    min={isEdit ? undefined : today}
                    value={s.arrivalDate}
                    onChange={(e) => set({ arrivalDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-time">Entrada</Label>
                  <Input
                    id="r-time"
                    type="time"
                    value={s.arrivalTime}
                    onChange={(e) => set({ arrivalTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="r-units">
                    {s.modality === 'DAILY' ? 'Días' : 'Horas'}
                  </Label>
                  <Input
                    id="r-units"
                    type="number"
                    min={1}
                    max={72}
                    value={Number.isFinite(s.units) ? s.units : ''}
                    onChange={(e) => set({ units: e.target.valueAsNumber })}
                  />
                </div>
              </div>
            )}

            {quote.data && stay && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <LogIn className="size-3.5" />
                  Entrada{' '}
                  <b className="text-foreground">
                    {formatDayTime(quote.data.checkIn)}
                  </b>
                </span>
                <span className="flex items-center gap-1">
                  <LogOut className="size-3.5" />
                  Salida{' '}
                  <b className="text-foreground">
                    {formatDayTime(quote.data.checkOut)}
                  </b>
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Stepper
                icon={Users}
                label="Adultos"
                value={s.adults}
                min={1}
                onChange={(adults) => set({ adults })}
              />
              <Stepper
                icon={Baby}
                label="Niños"
                value={s.children}
                min={0}
                onChange={(children) => set({ children })}
              />
            </div>
          </Section>

          <Section number={2} title="Tipo de habitación">
            {!stay && (
              <p className="text-sm text-muted-foreground">
                Completa las fechas para ver disponibilidad y precios.
              </p>
            )}
            {stay && quote.isLoading && (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            )}
            <div
              className={cn(
                'space-y-2 transition-opacity',
                quote.isFetching && !quote.isLoading && 'opacity-60',
              )}
            >
              {stay &&
                options.map((o) => {
                  const available = availableFor(o.roomType.id, o.available);
                  const disabled = !o.fitsGuests || available < 1;
                  const active = s.roomTypeId === o.roomType.id;
                  return (
                    <button
                      key={o.roomType.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => set({ roomTypeId: o.roomType.id })}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                        !disabled &&
                          'hover:border-primary/50 hover:bg-muted/40',
                        active &&
                          'border-primary bg-primary/5 ring-2 ring-primary/20',
                        disabled && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <BedDouble className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{o.roomType.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {!o.fitsGuests
                            ? `Máx. ${o.roomType.maxAdults} adultos y ${o.roomType.maxChildren} niños`
                            : available < 1
                              ? 'Sin disponibilidad'
                              : `${available} ${available === 1 ? 'disponible' : 'disponibles'}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">
                          {formatMoney(o.quote.totalAmount)}
                        </p>
                        {o.quote.extrasAmount > 0 && (
                          <p className="text-xs text-muted-foreground">
                            incl. {formatMoney(o.quote.extrasAmount)} extra
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </Section>
        </div>

        {/* Derecha: huésped, detalles y resumen */}
        <div className="min-h-0 space-y-6 border-t bg-muted/20 p-6 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <Section number={3} title="Huésped titular">
            <GuestPicker
              value={s.guest}
              onChange={(guest) => set({ guest, taxProfileId: NO_TAX })}
            />
          </Section>

          <Section number={4} title="Detalles">
            <div className="space-y-1.5">
              <Label>Origen</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(SOURCES) as ReservationSource[]).map((src) => (
                  <button
                    key={src}
                    type="button"
                    aria-pressed={s.source === src}
                    onClick={() => set({ source: src })}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted',
                      s.source === src &&
                        'border-primary bg-primary/10 text-primary hover:bg-primary/15',
                    )}
                  >
                    {SOURCES[src]}
                  </button>
                ))}
              </div>
            </div>

            {s.guest && (
              <div className="space-y-1.5">
                <Label htmlFor="r-tax">Facturar a</Label>
                <Select
                  items={taxItems}
                  value={s.taxProfileId}
                  onValueChange={(v) => v && set({ taxProfileId: v as string })}
                >
                  <SelectTrigger id="r-tax" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {taxItems.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <label className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
              <span>
                <span className="block text-sm font-medium">
                  Requiere anticipo
                </span>
                <span className="block text-xs text-muted-foreground">
                  Los pagos se registran en Cobros (Fase 7).
                </span>
              </span>
              <Switch
                checked={s.requiresDeposit}
                onCheckedChange={(requiresDeposit) => set({ requiresDeposit })}
              />
            </label>

            <div className="space-y-1.5">
              <Label htmlFor="r-notes">Notas</Label>
              <Textarea
                id="r-notes"
                rows={2}
                maxLength={1000}
                value={s.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Ej. llegará tarde, pidió cuna…"
              />
            </div>
          </Section>

          <Section number={5} title="Resumen">
            {selected ? (
              <div className="rounded-xl border bg-background p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <CalendarRange className="size-4 text-primary" />
                  {selected.roomType.name} ·{' '}
                  {unitLabel(s.modality, quote.data?.units ?? 0)} ·{' '}
                  {s.adults + s.children}{' '}
                  {s.adults + s.children === 1 ? 'persona' : 'personas'}
                </p>
                <PriceSummary
                  modality={s.modality}
                  baseAmount={selected.quote.baseAmount}
                  extrasAmount={selected.quote.extrasAmount}
                  totalAmount={selected.quote.totalAmount}
                  detail={selected.quote.detail}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Elige un tipo de habitación para ver el total.
              </p>
            )}
          </Section>
        </div>
      </div>

      <DialogFooter className="shrink-0 border-t p-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={!canSave || save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {isEdit ? 'Guardar cambios' : 'Confirmar reserva'}
          {selected && ` · ${formatMoney(selected.quote.totalAmount)}`}
        </Button>
      </DialogFooter>
    </>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">
          {number}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stepper({
  icon: Icon,
  label,
  value,
  min,
  onChange,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-2 pl-3">
      <span className="flex items-center gap-1.5 text-sm">
        <Icon className="size-4 text-muted-foreground" />
        {label}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Menos ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
        >
          <Minus />
        </Button>
        <span className="w-6 text-center font-semibold tabular-nums">
          {value}
        </span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Más ${label.toLowerCase()}`}
          disabled={value >= 20}
          onClick={() => onChange(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
