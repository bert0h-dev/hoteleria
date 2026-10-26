import { useState } from 'react';
import {
  CalendarDays,
  FlaskConical,
  CalendarRange,
  Check,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { getErrorMessage } from '@/lib/api';
import { formatDay, todayInHotel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useUpdateSettings, type Hotel } from './hotel-api';
import { priceNights } from './pricing';
import {
  formatPercent,
  SEASON_COLORS,
  useDeleteRatePeriod,
  useRatePeriods,
  useSaveRatePeriod,
  type RatePeriod,
  type SeasonColor,
} from './rate-periods-api';

// Lunes primero; el valor es el día de JavaScript (0 = domingo).
const WEEKDAYS = [
  { value: 1, short: 'Lun', label: 'lunes' },
  { value: 2, short: 'Mar', label: 'martes' },
  { value: 3, short: 'Mié', label: 'miércoles' },
  { value: 4, short: 'Jue', label: 'jueves' },
  { value: 5, short: 'Vie', label: 'viernes' },
  { value: 6, short: 'Sáb', label: 'sábado' },
  { value: 0, short: 'Dom', label: 'domingo' },
];

export function SeasonsSettings({ hotel }: { hotel: Hotel }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-5">
      <div className="xl:col-span-3">
        <SeasonsCard />
      </div>
      <div className="space-y-6 xl:col-span-2">
        <WeekdayRuleCard hotel={hotel} />
        <DateTester hotel={hotel} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ajuste por día de la semana
// ---------------------------------------------------------------------------

function WeekdayRuleCard({ hotel }: { hotel: Hotel }) {
  const update = useUpdateSettings();
  const [days, setDays] = useState<number[]>(hotel.settings.weekdayAdjustDays);
  const [percent, setPercent] = useState(hotel.settings.weekdayAdjustPercent);
  const dirty =
    percent !== hotel.settings.weekdayAdjustPercent ||
    [...days].sort().join() !==
      [...hotel.settings.weekdayAdjustDays].sort().join();
  const valid = Number.isInteger(percent) && percent >= -90 && percent <= 300;

  const toggle = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const save = async () => {
    try {
      await update.mutateAsync({
        weekdayAdjustDays: days,
        weekdayAdjustPercent: percent,
      });
      toast.success('Ajuste por día de la semana guardado');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const example = Math.round((1000 * (100 + (valid ? percent : 0))) / 100);
  const chosen = WEEKDAYS.filter((d) => days.includes(d.value)).map(
    (d) => d.label,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" />
          Días de la semana
        </CardTitle>
        <CardDescription>
          Ajuste para ciertos días, por ejemplo fines de semana. Se aplica a la
          noche de ese día y <b>no se suma</b> cuando hay temporada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d) => {
            const active = days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(d.value)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border py-2 text-xs font-medium transition-all hover:bg-muted',
                  active &&
                    'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {d.short}
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    active ? 'bg-primary-foreground' : 'bg-muted-foreground/30',
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="weekday-percent">Ajuste</Label>
          <div className="relative w-40">
            <Input
              id="weekday-percent"
              type="number"
              value={Number.isFinite(percent) ? percent : ''}
              onChange={(e) => setPercent(e.target.valueAsNumber)}
              className="pr-8"
              aria-invalid={!valid}
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Usa números negativos para descuentos (p. ej. −10 entre semana).
          </p>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          {days.length && valid && percent !== 0 ? (
            <>
              Una noche de <b>$1,000</b> cuesta{' '}
              <b>${example.toLocaleString('es-MX')}</b> los {chosen.join(', ')}.
            </>
          ) : (
            <span className="text-muted-foreground">
              Sin ajuste por día de la semana.
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t pt-6">
        <Button onClick={save} disabled={!dirty || !valid || update.isPending}>
          {update.isPending && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
      </CardFooter>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Temporadas
// ---------------------------------------------------------------------------

function SeasonsCard() {
  const { data: periods, isLoading } = useRatePeriods();
  const save = useSaveRatePeriod();
  const remove = useDeleteRatePeriod();
  const [editing, setEditing] = useState<RatePeriod | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<RatePeriod | null>(null);
  const today = todayInHotel();

  const toggleActive = async (p: RatePeriod) => {
    try {
      await save.mutateAsync({ id: p.id, isActive: !p.isActive });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(`Temporada «${deleting.name}» eliminada`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="size-4 text-primary" />
            Temporadas
          </CardTitle>
          <CardDescription>
            Ajuste del precio por noche entre dos fechas. Si se enciman, gana la
            de mayor prioridad (y si empatan, la más corta).
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus />
          Nueva
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {periods?.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aún no hay temporadas. Crea la primera, por ejemplo «Semana Santa»
            con +30 %.
          </p>
        )}
        {periods?.map((p) => {
          const color = SEASON_COLORS[p.color] ?? SEASON_COLORS.violet;
          const past = p.endDate < today;
          const current = p.startDate <= today && today <= p.endDate;
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 transition-opacity',
                (!p.isActive || past) && 'opacity-55',
              )}
            >
              <span
                className={cn('h-10 w-1.5 shrink-0 rounded-full', color.dot)}
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {p.name}
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      color.soft,
                    )}
                  >
                    {formatPercent(p.adjustmentPercent)}
                  </span>
                  {current && p.isActive && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Vigente
                    </span>
                  )}
                  {past && (
                    <span className="text-[10px] text-muted-foreground">
                      Terminada
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDay(p.startDate)} – {formatDay(p.endDate)}
                  {p.priority > 0 && ` · prioridad ${p.priority}`}
                </p>
              </div>
              <Switch
                checked={p.isActive}
                onCheckedChange={() => toggleActive(p)}
                aria-label={p.isActive ? 'Desactivar' : 'Activar'}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Editar ${p.name}`}
                onClick={() => {
                  setEditing(p);
                  setFormOpen(true);
                }}
              >
                <Pencil />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Eliminar ${p.name}`}
                onClick={() => setDeleting(p)}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </CardContent>

      <SeasonFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        period={editing}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar «{deleting?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Las reservas ya hechas conservan su precio. Si solo quieres
              pausarla, desactívala.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SeasonFormDialog({
  open,
  onOpenChange,
  period,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: RatePeriod | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <SeasonForm period={period} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SeasonForm({
  period,
  onDone,
}: {
  period: RatePeriod | null;
  onDone: () => void;
}) {
  const save = useSaveRatePeriod();
  const today = todayInHotel();
  const [name, setName] = useState(period?.name ?? '');
  const [startDate, setStartDate] = useState(period?.startDate ?? today);
  const [endDate, setEndDate] = useState(period?.endDate ?? today);
  const [percent, setPercent] = useState(period?.adjustmentPercent ?? 20);
  const [priority, setPriority] = useState(period?.priority ?? 0);
  const [color, setColor] = useState<SeasonColor>(period?.color ?? 'violet');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return setError('Escribe el nombre de la temporada');
    if (!startDate || !endDate) return setError('Indica las fechas');
    if (endDate < startDate)
      return setError('La fecha de fin no puede ser anterior a la de inicio');
    if (!Number.isInteger(percent) || percent < -90 || percent > 300) {
      return setError('El ajuste debe ser un entero entre −90 y 300 %');
    }
    setError(null);
    try {
      await save.mutateAsync({
        id: period?.id,
        name: name.trim(),
        startDate,
        endDate,
        adjustmentPercent: percent,
        priority: Number.isInteger(priority) ? priority : 0,
        color,
      });
      toast.success(period ? 'Temporada actualizada' : 'Temporada creada');
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {period ? 'Editar temporada' : 'Nueva temporada'}
        </DialogTitle>
        <DialogDescription>
          Las reservas ya hechas conservan su precio.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="s-name">Nombre</Label>
          <Input
            id="s-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Semana Santa"
            maxLength={60}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-start">Desde</Label>
            <Input
              id="s-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-end">Hasta (inclusive)</Label>
            <Input
              id="s-end"
              type="date"
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-percent">Ajuste</Label>
            <div className="relative">
              <Input
                id="s-percent"
                type="number"
                value={Number.isFinite(percent) ? percent : ''}
                onChange={(e) => setPercent(e.target.valueAsNumber)}
                className="pr-8"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-priority">Prioridad</Label>
            <Input
              id="s-priority"
              type="number"
              min={0}
              max={100}
              value={Number.isFinite(priority) ? priority : ''}
              onChange={(e) => setPriority(e.target.valueAsNumber)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Positivo para aumentar (30 = +30 %) y negativo para descuento (−15).
          Con $1,000 la noche quedaría en{' '}
          <b>
            $
            {Math.round(
              (1000 * (100 + (Number.isFinite(percent) ? percent : 0))) / 100,
            ).toLocaleString('es-MX')}
          </b>
          .
        </p>
        <div className="space-y-1.5">
          <Label>Color en el calendario</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SEASON_COLORS) as SeasonColor[]).map((c) => (
              <button
                key={c}
                type="button"
                aria-label={SEASON_COLORS[c].label}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn(
                  'grid size-8 place-items-center rounded-full text-white ring-offset-2 ring-offset-background transition-transform hover:scale-110',
                  SEASON_COLORS[c].dot,
                  color === c && 'ring-2 ring-foreground',
                )}
              >
                {color === c && <Check className="size-4" />}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {period ? 'Guardar cambios' : 'Crear temporada'}
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Probar una fecha
// ---------------------------------------------------------------------------

/** Muestra el precio de una noche en cualquier fecha y qué regla aplica. */
function DateTester({ hotel }: { hotel: Hotel }) {
  const { data: periods } = useRatePeriods();
  const [date, setDate] = useState(todayInHotel());
  const [base, setBase] = useState(1000);
  const valid = !!date && Number.isInteger(base) && base > 0;

  const [night] = valid
    ? priceNights(
        base,
        [date],
        (periods ?? []).filter((p) => p.isActive),
        {
          days: hotel.settings.weekdayAdjustDays,
          percent: hotel.settings.weekdayAdjustPercent,
        },
      )
    : [];
  const weekday = date
    ? new Date(`${date}T12:00:00Z`).toLocaleDateString('es-MX', {
        weekday: 'long',
        timeZone: 'UTC',
      })
    : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" />
          Probar una fecha
        </CardTitle>
        <CardDescription>
          Con las reglas guardadas. Útil para revisar antes de una temporada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="test-date">Noche del</Label>
            <Input
              id="test-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="test-base">Precio base</Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="test-base"
                type="number"
                min={1}
                value={Number.isFinite(base) ? base : ''}
                onChange={(e) => setBase(e.target.valueAsNumber)}
                className="pl-6"
              />
            </div>
          </div>
        </div>
        {night && (
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
            <div>
              <p className="text-sm capitalize">{weekday}</p>
              <p className="text-xs text-muted-foreground">
                {night.source === 'season'
                  ? `Temporada «${night.seasonName}» (${formatPercent(night.adjustmentPercent)})`
                  : night.source === 'weekday'
                    ? `Ajuste por día (${formatPercent(night.adjustmentPercent)})`
                    : 'Precio base, sin ajuste'}
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              ${night.rate.toLocaleString('es-MX')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
