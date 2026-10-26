import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { phoneField } from '@/features/users/schemas';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getErrorMessage } from '@/lib/api';
import { todayInHotel } from '@/lib/format';
import { COUNTRY_OPTIONS } from '../countries';
import { useGuestDuplicates, useSaveGuest } from '../guests-api';
import {
  DOCUMENT_TYPES,
  type DocumentType,
  type DuplicateGuest,
  type Guest,
} from '../types';
import { DuplicatesAlert } from './duplicates-alert';

const NONE = 'none';

const schema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'Escribe el nombre')
      .max(80, 'Máximo 80 caracteres'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Escribe los apellidos')
      .max(80, 'Máximo 80 caracteres'),
    phone: phoneField,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (v) => !v || z.email().safeParse(v).success,
        'El correo no es válido',
      ),
    birthDate: z.string(),
    nationality: z.string(),
    documentType: z.string(),
    documentNumber: z
      .string()
      .trim()
      .toUpperCase()
      .max(30, 'Máximo 30 caracteres'),
    city: z.string().trim().max(80, 'Máximo 80 caracteres'),
    state: z.string().trim().max(80, 'Máximo 80 caracteres'),
    country: z.string(),
    isVip: z.boolean(),
    notes: z.string().max(1000, 'Máximo 1000 caracteres'),
    privacyAccepted: z.boolean(),
  })
  .refine((v) => v.phone || v.email, {
    path: ['phone'],
    message: 'Indica al menos un teléfono o un correo',
  })
  .refine((v) => (v.documentType === NONE) === !v.documentNumber, {
    path: ['documentNumber'],
    message: 'Indica el tipo y el número de identificación juntos',
  });

type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  birthDate: '',
  nationality: 'MX',
  documentType: NONE,
  documentNumber: '',
  city: '',
  state: '',
  country: 'MX',
  isVip: false,
  notes: '',
  privacyAccepted: false,
};

function toValues(guest: Guest): Values {
  return {
    firstName: guest.firstName,
    lastName: guest.lastName,
    phone: guest.phone ?? '',
    email: guest.email ?? '',
    birthDate: guest.birthDate ?? '',
    nationality: guest.nationality ?? NONE,
    documentType: guest.documentType ?? NONE,
    documentNumber: guest.documentNumber ?? '',
    city: guest.city ?? '',
    state: guest.state ?? '',
    country: guest.country ?? NONE,
    isVip: guest.isVip,
    notes: guest.notes ?? '',
    privacyAccepted: !!guest.privacyAcceptedAt,
  };
}

const DOC_ITEMS = [
  { value: NONE, label: 'Sin identificación' },
  ...Object.entries(DOCUMENT_TYPES).map(([value, label]) => ({ value, label })),
];
const COUNTRY_ITEMS = [{ value: NONE, label: '—' }, ...COUNTRY_OPTIONS];

/**
 * Crea o edita un huésped. Avisa de posibles duplicados mientras se
 * escribe y, si se indica `onUseExisting`, permite elegir el existente.
 */
export function GuestFormDialog({
  open,
  onOpenChange,
  guest,
  initialName,
  onSaved,
  onUseExisting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guest?: Guest | null;
  /** Texto con el que prellenar nombre y apellidos (p. ej. lo buscado). */
  initialName?: string;
  onSaved?: (guest: Guest) => void;
  onUseExisting?: (guest: DuplicateGuest) => void;
}) {
  const isEdit = !!guest;
  const save = useSaveGuest();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    if (guest) {
      reset(toValues(guest));
    } else {
      const [first = '', ...rest] = (initialName ?? '').trim().split(/\s+/);
      reset({ ...EMPTY, firstName: first, lastName: rest.join(' ') });
    }
  }, [open, guest, initialName, reset]);

  // Duplicados: se consultan con un pequeño retraso mientras se escribe.
  const [phone, email, documentType, documentNumber] = useWatch({
    control,
    name: ['phone', 'email', 'documentType', 'documentNumber'],
  });
  // Se retrasa un texto (no un objeto nuevo en cada render) para no
  // provocar renders en bucle.
  const lookupKey = useDebouncedValue(
    JSON.stringify({
      phone,
      email,
      documentType:
        documentType === NONE ? null : (documentType as DocumentType),
      documentNumber,
      excludeId: guest?.id,
    }),
    400,
  );
  const lookup = useMemo(
    () => JSON.parse(lookupKey) as Parameters<typeof useGuestDuplicates>[0],
    [lookupKey],
  );
  const duplicates = useGuestDuplicates(lookup);

  const onSubmit = handleSubmit(async (v) => {
    const orNull = (s: string) => (s && s !== NONE ? s : null);
    try {
      const saved = await save.mutateAsync({
        id: guest?.id,
        firstName: v.firstName,
        lastName: v.lastName,
        phone: orNull(v.phone),
        email: orNull(v.email),
        birthDate: orNull(v.birthDate),
        nationality: orNull(v.nationality),
        documentType: orNull(v.documentType) as DocumentType | null,
        documentNumber: orNull(v.documentNumber),
        city: orNull(v.city),
        state: orNull(v.state),
        country: orNull(v.country),
        isVip: v.isVip,
        notes: orNull(v.notes.trim()),
        privacyAccepted: v.privacyAccepted,
      });
      toast.success(isEdit ? 'Huésped actualizado' : 'Huésped registrado');
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const selectField = (
    name: 'documentType' | 'nationality' | 'country',
    id: string,
    items: { value: string; label: string }[],
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          items={items}
          value={field.value}
          onValueChange={(v) => v && field.onChange(v)}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  const section = (title: string) => (
    <p className="col-span-full -mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
      {title}
    </p>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar huésped' : 'Nuevo huésped'}
          </DialogTitle>
          <DialogDescription>
            Datos del titular de la estancia. Solo nombre, apellidos y un dato
            de contacto son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <form id="guest-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {section('Identidad')}
            <Field data-invalid={!!errors.firstName}>
              <FieldLabel htmlFor="g-first">Nombre(s)</FieldLabel>
              <Input id="g-first" autoFocus {...register('firstName')} />
              <FieldError errors={[errors.firstName]} />
            </Field>
            <Field data-invalid={!!errors.lastName}>
              <FieldLabel htmlFor="g-last">Apellidos</FieldLabel>
              <Input id="g-last" {...register('lastName')} />
              <FieldError errors={[errors.lastName]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="g-birth">Fecha de nacimiento</FieldLabel>
              <Input
                id="g-birth"
                type="date"
                max={todayInHotel()}
                {...register('birthDate')}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="g-nationality">Nacionalidad</FieldLabel>
              {selectField('nationality', 'g-nationality', COUNTRY_ITEMS)}
            </Field>

            {section('Contacto')}
            <Field data-invalid={!!errors.phone}>
              <FieldLabel htmlFor="g-phone">Teléfono</FieldLabel>
              <Input
                id="g-phone"
                type="tel"
                placeholder="998 123 4567"
                {...register('phone')}
              />
              <FieldError errors={[errors.phone]} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="g-email">Correo</FieldLabel>
              <Input
                id="g-email"
                type="email"
                placeholder="huesped@correo.com"
                {...register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>

            {section('Identificación')}
            <Field>
              <FieldLabel htmlFor="g-doc-type">Tipo</FieldLabel>
              {selectField('documentType', 'g-doc-type', DOC_ITEMS)}
            </Field>
            <Field data-invalid={!!errors.documentNumber}>
              <FieldLabel htmlFor="g-doc-number">Número</FieldLabel>
              <Input
                id="g-doc-number"
                className="uppercase"
                {...register('documentNumber')}
              />
              <FieldError errors={[errors.documentNumber]} />
            </Field>

            <div className="col-span-full">
              <DuplicatesAlert
                duplicates={duplicates.data ?? []}
                onUse={
                  onUseExisting &&
                  ((d) => {
                    onUseExisting(d);
                    onOpenChange(false);
                  })
                }
              />
            </div>

            {section('Procedencia')}
            <Field>
              <FieldLabel htmlFor="g-city">Ciudad</FieldLabel>
              <Input id="g-city" {...register('city')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="g-state">Estado / provincia</FieldLabel>
              <Input id="g-state" {...register('state')} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="g-country">País</FieldLabel>
              {selectField('country', 'g-country', COUNTRY_ITEMS)}
            </Field>

            {section('Otros')}
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="g-notes">Notas y preferencias</FieldLabel>
              <Textarea
                id="g-notes"
                rows={2}
                placeholder="Ej. prefiere planta baja, alérgico a plumas…"
                {...register('notes')}
              />
              <FieldError errors={[errors.notes]} />
            </Field>
            <Controller
              control={control}
              name="isVip"
              render={({ field }) => (
                <Field
                  orientation="horizontal"
                  className="rounded-lg border p-3"
                >
                  <FieldContent>
                    <FieldLabel htmlFor="g-vip">Huésped VIP</FieldLabel>
                    <FieldDescription>Atención preferente.</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="g-vip"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="privacyAccepted"
              render={({ field }) => (
                <Field
                  orientation="horizontal"
                  className="rounded-lg border p-3"
                >
                  <FieldContent>
                    <FieldLabel htmlFor="g-privacy">
                      Aviso de privacidad
                    </FieldLabel>
                    <FieldDescription>El huésped lo aceptó.</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="g-privacy"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="guest-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Registrar huésped'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
