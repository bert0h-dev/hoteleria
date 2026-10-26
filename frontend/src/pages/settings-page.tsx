import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Baby,
  Building2,
  Globe,
  Receipt,
  CalendarRange,
  Calculator,
  Clock,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useHotel,
  useUpdateHotel,
  useUpdateSettings,
  type Hotel,
} from '@/features/hotel/hotel-api';
import {
  calculateHourlyStay,
  calculateNightlyStay,
  calculateRates,
  hoursUntilDayRate,
} from '@/features/hotel/pricing';
import { TaxBreakdown } from '@/features/hotel/tax-breakdown';
import { TimeZoneSelect } from '@/features/hotel/time-zone-select';
import { RatesGrid } from '@/features/rooms/components/rates-grid';
import { getErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';

export function SettingsPage() {
  const { data: hotel, isLoading } = useHotel();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Datos del hotel, tarifas y horarios."
      />
      {isLoading || !hotel ? (
        <div className="grid gap-6 xl:grid-cols-5">
          <Skeleton className="h-96 rounded-xl xl:col-span-3" />
          <Skeleton className="h-96 rounded-xl xl:col-span-2" />
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <RatesForm hotel={hotel} />
          </div>
          <div className="xl:col-span-2">
            <HotelForm hotel={hotel} />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarifas y horarios
// ---------------------------------------------------------------------------

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:mm (ej. 15:00)');

const intIn = (min: number, max: number, unit = '') =>
  z
    .number({ error: 'Escribe un número' })
    .int('Debe ser un número entero')
    .min(min, `Mínimo ${min}${unit}`)
    .max(max, `Máximo ${max}${unit}`);

const decimalIn = (min: number, max: number) =>
  z
    .number({ error: 'Escribe un número' })
    .min(min, `Mínimo ${min} %`)
    .max(max, `Máximo ${max} %`)
    .refine((n) => Math.round(n * 100) === n * 100, 'Usa máximo 2 decimales');

const settingsSchema = z.object({
  hourlyRatePercent: intIn(1, 100, ' %'),
  minHours: intIn(1, 24, ' h'),
  dayRatePercent: intIn(1, 500, ' %'),
  dayDurationHours: intIn(1, 72, ' h'),
  weekRatePercent: intIn(100, 700, ' %'),
  checkInTime: time,
  checkOutTime: time,
  capHourlyAtDayRate: z.boolean(),
  vatPercent: decimalIn(0, 30),
  lodgingTaxPercent: decimalIn(0, 10),
  childMaxAge: intIn(0, 17, ' años'),
});

type SettingsValues = z.infer<typeof settingsSchema>;

function RatesForm({ hotel }: { hotel: Hotel }) {
  const update = useUpdateSettings();
  const [sample, setSample] = useState(1000);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: pickSettings(hotel),
  });

  useEffect(() => reset(pickSettings(hotel)), [hotel, reset]);

  const live = useWatch({ control }) as SettingsValues;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success('Configuración guardada', {
        description: 'Las tarifas de todos los tipos se recalcularon.',
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const pct = (name: keyof SettingsValues, suffix: string, step = 1) => (
    <div className="relative">
      <Input
        type="number"
        step={step}
        className="pr-10"
        aria-invalid={!!errors[name]}
        {...register(name, { valueAsNumber: true })}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
        {suffix}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="size-4 text-primary" />
          Tarifas y horarios
        </CardTitle>
        <CardDescription>
          El precio base es por noche. Las demás modalidades se calculan con
          estos porcentajes y se redondean al peso más cercano.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent className="space-y-6">
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={!!errors.hourlyRatePercent}>
              <FieldLabel className="flex items-center gap-1.5">
                <Clock className="size-3.5" /> Por hora
              </FieldLabel>
              {pct('hourlyRatePercent', '%')}
              <FieldDescription>% del precio por noche.</FieldDescription>
              <FieldError errors={[errors.hourlyRatePercent]} />
            </Field>
            <Field data-invalid={!!errors.minHours}>
              <FieldLabel>Mínimo de horas</FieldLabel>
              {pct('minHours', 'h')}
              <FieldDescription>Horas mínimas a cobrar.</FieldDescription>
              <FieldError errors={[errors.minHours]} />
            </Field>
            <Field data-invalid={!!errors.dayRatePercent}>
              <FieldLabel className="flex items-center gap-1.5">
                <Sun className="size-3.5" /> Por día
              </FieldLabel>
              {pct('dayRatePercent', '%')}
              <FieldDescription>% del precio por noche.</FieldDescription>
              <FieldError errors={[errors.dayRatePercent]} />
            </Field>
            <Field data-invalid={!!errors.dayDurationHours}>
              <FieldLabel>Duración del día</FieldLabel>
              {pct('dayDurationHours', 'h')}
              <FieldDescription>
                Salida = hora de entrada + estas horas.
              </FieldDescription>
              <FieldError errors={[errors.dayDurationHours]} />
            </Field>
            <Field data-invalid={!!errors.weekRatePercent}>
              <FieldLabel className="flex items-center gap-1.5">
                <CalendarRange className="size-3.5" /> Por semana
              </FieldLabel>
              {pct('weekRatePercent', '%')}
              <FieldDescription>
                {Number.isFinite(live.weekRatePercent)
                  ? `Equivale a ${+(live.weekRatePercent / 100).toFixed(2)} noches. Se aplica por bloques de 7 noches.`
                  : 'Se aplica por bloques de 7 noches.'}
              </FieldDescription>
              <FieldError errors={[errors.weekRatePercent]} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.checkInTime}>
                <FieldLabel className="flex items-center gap-1.5">
                  <Moon className="size-3.5" /> Entrada
                </FieldLabel>
                <Input type="time" {...register('checkInTime')} />
                <FieldError errors={[errors.checkInTime]} />
              </Field>
              <Field data-invalid={!!errors.checkOutTime}>
                <FieldLabel>Salida</FieldLabel>
                <Input type="time" {...register('checkOutTime')} />
                <FieldError errors={[errors.checkOutTime]} />
              </Field>
              <FieldDescription className="col-span-2 -mt-3">
                Horario de la modalidad por noche.
              </FieldDescription>
            </div>
          </FieldGroup>

          <div className="space-y-4 border-t pt-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="size-4 text-primary" />
                Impuestos y huéspedes
              </p>
              <p className="text-sm text-muted-foreground">
                Los precios <b>ya incluyen</b> IVA e ISH; aquí solo se indica
                cuánto desglosar en los comprobantes.
              </p>
            </div>
            <FieldGroup className="grid gap-5 sm:grid-cols-3">
              <Field data-invalid={!!errors.vatPercent}>
                <FieldLabel>IVA</FieldLabel>
                {pct('vatPercent', '%', 0.01)}
                <FieldError errors={[errors.vatPercent]} />
              </Field>
              <Field data-invalid={!!errors.lodgingTaxPercent}>
                <FieldLabel>ISH</FieldLabel>
                {pct('lodgingTaxPercent', '%', 0.01)}
                <FieldDescription>Impuesto Sobre Hospedaje.</FieldDescription>
                <FieldError errors={[errors.lodgingTaxPercent]} />
              </Field>
              <Field data-invalid={!!errors.childMaxAge}>
                <FieldLabel className="flex items-center gap-1.5">
                  <Baby className="size-3.5" /> Edad de niño
                </FieldLabel>
                {pct('childMaxAge', 'años')}
                <FieldDescription>
                  Hasta esta edad cuenta como niño.
                </FieldDescription>
                <FieldError errors={[errors.childMaxAge]} />
              </Field>
            </FieldGroup>
            <Controller
              control={control}
              name="capHourlyAtDayRate"
              render={({ field }) => (
                <Field
                  orientation="horizontal"
                  className="rounded-lg border p-4"
                >
                  <FieldContent>
                    <FieldLabel htmlFor="cap-hourly">
                      Tope de la tarifa por hora
                    </FieldLabel>
                    <FieldDescription>
                      Si las horas cuestan más que el día completo, se cobra el
                      día.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="cap-hourly"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />
          </div>

          <LiveCalculator
            settings={live}
            sample={sample}
            onSample={setSample}
          />
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t pt-6">
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => reset(pickSettings(hotel))}
            >
              Descartar
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Guardar configuración
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function pickSettings(hotel: Hotel): SettingsValues {
  const s = hotel.settings;
  return {
    hourlyRatePercent: s.hourlyRatePercent,
    minHours: s.minHours,
    dayRatePercent: s.dayRatePercent,
    dayDurationHours: s.dayDurationHours,
    weekRatePercent: s.weekRatePercent,
    checkInTime: s.checkInTime,
    checkOutTime: s.checkOutTime,
    capHourlyAtDayRate: s.capHourlyAtDayRate,
    vatPercent: s.vatPercent,
    lodgingTaxPercent: s.lodgingTaxPercent,
    childMaxAge: s.childMaxAge,
  };
}

function addHours(hhmm: string, hours: number) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + hours * 60;
  const days = Math.floor(total / (24 * 60));
  const mins = total % (24 * 60);
  const text = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  if (days === 0) return `${text} del mismo día`;
  if (days === 1) return `${text} del día siguiente`;
  return `${text}, ${days} días después`;
}

/** Ejemplos con los valores del formulario (aún sin guardar). */
function LiveCalculator({
  settings,
  sample,
  onSample,
}: {
  settings: SettingsValues;
  sample: number;
  onSample: (n: number) => void;
}) {
  const valid =
    Number.isInteger(sample) &&
    sample > 0 &&
    settingsSchema.safeParse(settings).success;

  const rates = valid ? calculateRates(sample, settings) : null;
  const hourly = valid ? calculateHourlyStay(1, sample, settings) : null;
  const tenNights = valid ? calculateNightlyStay(10, sample, settings) : null;
  const dayFrom = valid ? hoursUntilDayRate(sample, settings) : null;

  return (
    <div className="space-y-4 rounded-xl border bg-linear-to-br from-brand-from/[0.07] to-brand-to/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="size-4 text-primary" />
          Calculadora de ejemplo
        </p>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Precio por noche
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm">
              $
            </span>
            <Input
              type="number"
              min={1}
              step={1}
              value={Number.isFinite(sample) ? sample : ''}
              onChange={(e) => onSample(e.target.valueAsNumber)}
              className="h-8 w-28 bg-background pl-6"
              aria-label="Precio por noche de ejemplo"
            />
          </div>
        </label>
      </div>

      {rates && hourly && tenNights ? (
        <>
          <RatesGrid rates={rates} settings={settings} />
          <ul className="space-y-1.5 text-sm">
            <Example>
              Estancia por horas (mín. {settings.minHours} h):{' '}
              <b>{formatMoney(hourly.total)}</b>
              {dayFrom && (
                <>
                  {' '}
                  · desde <b>{dayFrom} h</b> se cobra el día (
                  {formatMoney(rates.daily)})
                </>
              )}
            </Example>
            <Example>
              Día completo: entrada 10:30 → salida{' '}
              <b>{addHours('10:30', settings.dayDurationHours)}</b>
            </Example>
            <Example>
              Noche: entrada <b>{settings.checkInTime}</b>, salida{' '}
              <b>{settings.checkOutTime}</b> del día siguiente
            </Example>
            <Example>
              10 noches = {tenNights.weeks} semana + {tenNights.extraNights}{' '}
              noches = <b>{formatMoney(tenNights.total)}</b>
            </Example>
          </ul>
          <div className="rounded-lg border bg-background/60 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Desglose de una noche de {formatMoney(sample)}
            </p>
            <TaxBreakdown total={sample} taxes={settings} />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Corrige los valores marcados para ver el cálculo.
        </p>
      )}
    </div>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-muted-foreground">
      <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
      <span className="[&_b]:font-semibold [&_b]:text-foreground">
        {children}
      </span>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Datos del hotel
// ---------------------------------------------------------------------------

const hotelSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del hotel').max(120),
  legalName: z.string().trim().max(200, 'Demasiado largo'),
  taxId: z
    .string()
    .trim()
    .toUpperCase()
    .max(13, 'El RFC tiene máximo 13 caracteres'),
  address: z.string().trim().max(300, 'Demasiado larga'),
  phone: z.string().trim().max(30, 'Demasiado largo'),
  email: z
    .string()
    .trim()
    .refine(
      (v) => !v || z.email().safeParse(v).success,
      'El correo no es válido',
    ),
  timezone: z.string().min(1, 'Elige la zona horaria'),
});

type HotelValues = z.infer<typeof hotelSchema>;

function toHotelValues(hotel: Hotel): HotelValues {
  return {
    name: hotel.name,
    legalName: hotel.legalName ?? '',
    taxId: hotel.taxId ?? '',
    address: hotel.address ?? '',
    phone: hotel.phone ?? '',
    email: hotel.email ?? '',
    timezone: hotel.timezone,
  };
}

function HotelForm({ hotel }: { hotel: Hotel }) {
  const update = useUpdateHotel();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<HotelValues>({
    resolver: zodResolver(hotelSchema),
    defaultValues: toHotelValues(hotel),
  });

  useEffect(() => reset(toHotelValues(hotel)), [hotel, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      // Los campos vacíos se guardan como null.
      await update.mutateAsync({
        name: values.name,
        legalName: values.legalName || null,
        taxId: values.taxId || null,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
        timezone: values.timezone,
      });
      toast.success('Datos del hotel guardados');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const fields: {
    name: keyof HotelValues;
    label: string;
    placeholder?: string;
    type?: string;
  }[] = [
    { name: 'name', label: 'Nombre comercial', placeholder: 'Mi Hotel' },
    {
      name: 'legalName',
      label: 'Razón social',
      placeholder: 'Mi Hotel S.A. de C.V.',
    },
    { name: 'taxId', label: 'RFC', placeholder: 'MHO010101ABC' },
    { name: 'address', label: 'Dirección' },
    { name: 'phone', label: 'Teléfono', type: 'tel' },
    { name: 'email', label: 'Correo', type: 'email' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          Datos del hotel
        </CardTitle>
        <CardDescription>Se usarán en folios y comprobantes.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent>
          <FieldGroup className="gap-4">
            {fields.map((f) => (
              <Field key={f.name} data-invalid={!!errors[f.name]}>
                <FieldLabel htmlFor={`hotel-${f.name}`}>{f.label}</FieldLabel>
                <Input
                  id={`hotel-${f.name}`}
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  className={f.name === 'taxId' ? 'uppercase' : undefined}
                  aria-invalid={!!errors[f.name]}
                  {...register(f.name)}
                />
                <FieldError errors={[errors[f.name]]} />
              </Field>
            ))}
            <Field data-invalid={!!errors.timezone}>
              <FieldLabel
                htmlFor="hotel-timezone"
                className="flex items-center gap-1.5"
              >
                <Globe className="size-3.5" /> Zona horaria
              </FieldLabel>
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <TimeZoneSelect
                    id="hotel-timezone"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <FieldDescription>
                Todas las fechas y horas del sistema se muestran en esta zona.
              </FieldDescription>
              <FieldError errors={[errors.timezone]} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6 justify-end border-t pt-6">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Guardar datos
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
