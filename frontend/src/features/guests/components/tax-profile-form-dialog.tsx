import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Loader2, User } from 'lucide-react';
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
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useSatCatalogs, useSaveTaxProfile } from '../guests-api';
import {
  GENERIC_RFCS,
  isGenericRfc,
  isValidRfc,
  normalizeRfc,
  personTypeOf,
} from '../rfc';
import type { TaxProfile } from '../types';

const schema = z.object({
  rfc: z
    .string()
    .transform(normalizeRfc)
    .refine(
      isValidRfc,
      'RFC no válido: 12 caracteres (persona moral) o 13 (persona física)',
    ),
  legalName: z
    .string()
    .trim()
    .min(1, 'Escribe la razón social o el nombre')
    .max(254, 'Demasiado largo'),
  taxRegime: z.string().min(1, 'Elige el régimen fiscal'),
  zipCode: z.string().regex(/^\d{5}$/, 'El código postal tiene 5 dígitos'),
  cfdiUse: z.string().min(1, 'Elige el uso de CFDI'),
  invoiceEmail: z
    .string()
    .trim()
    .refine(
      (v) => !v || z.email().safeParse(v).success,
      'El correo no es válido',
    ),
  isDefault: z.boolean(),
});

type Values = z.input<typeof schema>;
type Output = z.output<typeof schema>;

const EMPTY: Values = {
  rfc: '',
  legalName: '',
  taxRegime: '',
  zipCode: '',
  cfdiUse: 'G03',
  invoiceEmail: '',
  isDefault: false,
};

export function TaxProfileFormDialog({
  guestId,
  open,
  onOpenChange,
  profile,
  isFirst,
  defaultEmail,
}: {
  guestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: TaxProfile | null;
  /** El primer perfil siempre queda como predeterminado. */
  isFirst: boolean;
  defaultEmail?: string | null;
}) {
  const isEdit = !!profile;
  const save = useSaveTaxProfile(guestId);
  const { data: catalogs } = useSatCatalogs();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values, unknown, Output>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    reset(
      profile
        ? { ...profile, invoiceEmail: profile.invoiceEmail ?? '' }
        : { ...EMPTY, invoiceEmail: defaultEmail ?? '', isDefault: isFirst },
    );
  }, [open, profile, isFirst, defaultEmail, reset]);

  const rfc = normalizeRfc(useWatch({ control, name: 'rfc' }) ?? '');
  const validRfc = isValidRfc(rfc);
  const generic = validRfc && isGenericRfc(rfc);
  const person = validRfc ? personTypeOf(rfc) : null;

  // Solo se ofrecen las claves que aplican al tipo de persona del RFC.
  const regimes = (catalogs?.taxRegimes ?? []).filter(
    (r) =>
      !person || (generic ? r.code === '616' : r.appliesTo.includes(person)),
  );
  const uses = (catalogs?.cfdiUses ?? []).filter(
    (u) => !generic || u.code === 'S01',
  );
  const regimeItems = regimes.map((r) => ({
    value: r.code,
    label: `${r.code} · ${r.name}`,
  }));
  const useItems = uses.map((u) => ({
    value: u.code,
    label: `${u.code} · ${u.name}`,
  }));

  // Con RFC genérico, el régimen y el uso quedan fijos.
  useEffect(() => {
    if (generic) {
      setValue('taxRegime', '616');
      setValue('cfdiUse', 'S01');
    }
  }, [generic, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        id: profile?.id,
        rfc: v.rfc,
        legalName: v.legalName,
        taxRegime: v.taxRegime,
        zipCode: v.zipCode,
        cfdiUse: v.cfdiUse,
        invoiceEmail: v.invoiceEmail || null,
        isDefault: v.isDefault,
      });
      toast.success(
        isEdit ? 'Datos fiscales actualizados' : 'Datos fiscales agregados',
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const select = (
    name: 'taxRegime' | 'cfdiUse',
    id: string,
    items: { value: string; label: string }[],
    placeholder: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Select
          items={items}
          value={field.value || null}
          onValueChange={(v) => v && field.onChange(v)}
          disabled={generic}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={placeholder} />
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar datos fiscales' : 'Agregar datos fiscales'}
          </DialogTitle>
          <DialogDescription>
            Tal como aparecen en la Constancia de Situación Fiscal (CFDI 4.0).
          </DialogDescription>
        </DialogHeader>

        <form id="tax-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.rfc}>
              <FieldLabel htmlFor="tax-rfc">RFC</FieldLabel>
              <Input
                id="tax-rfc"
                className="font-mono uppercase"
                placeholder="XAXX010101000"
                {...register('rfc')}
              />
              <div className="flex flex-wrap items-center gap-2">
                {person && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      'bg-primary/10 text-primary',
                    )}
                  >
                    {person === 'FISICA' ? (
                      <User className="size-3" />
                    ) : (
                      <Building2 className="size-3" />
                    )}
                    {generic
                      ? GENERIC_RFCS[rfc as keyof typeof GENERIC_RFCS]
                      : person === 'FISICA'
                        ? 'Persona física'
                        : 'Persona moral'}
                  </span>
                )}
                {!isEdit &&
                  Object.entries(GENERIC_RFCS).map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() =>
                        setValue('rfc', code, { shouldValidate: true })
                      }
                      className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                    >
                      {label}
                    </button>
                  ))}
              </div>
              <FieldError errors={[errors.rfc]} />
            </Field>

            <Field data-invalid={!!errors.legalName}>
              <FieldLabel htmlFor="tax-name">Razón social o nombre</FieldLabel>
              <Input
                id="tax-name"
                className="uppercase"
                {...register('legalName')}
              />
              <FieldDescription>
                Sin el régimen de capital (no agregues "S.A. de C.V.").
              </FieldDescription>
              <FieldError errors={[errors.legalName]} />
            </Field>

            <Field data-invalid={!!errors.taxRegime}>
              <FieldLabel htmlFor="tax-regime">Régimen fiscal</FieldLabel>
              {select(
                'taxRegime',
                'tax-regime',
                regimeItems,
                'Elige el régimen',
              )}
              <FieldError errors={[errors.taxRegime]} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.zipCode}>
                <FieldLabel htmlFor="tax-zip">C.P. fiscal</FieldLabel>
                <Input
                  id="tax-zip"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="77500"
                  {...register('zipCode')}
                />
                <FieldError errors={[errors.zipCode]} />
              </Field>
              <Field data-invalid={!!errors.cfdiUse}>
                <FieldLabel htmlFor="tax-use">Uso de CFDI</FieldLabel>
                {select('cfdiUse', 'tax-use', useItems, 'Elige el uso')}
                <FieldError errors={[errors.cfdiUse]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.invoiceEmail}>
              <FieldLabel htmlFor="tax-email">
                Correo para la factura
              </FieldLabel>
              <Input
                id="tax-email"
                type="email"
                {...register('invoiceEmail')}
              />
              <FieldError errors={[errors.invoiceEmail]} />
            </Field>

            <Controller
              control={control}
              name="isDefault"
              render={({ field }) => (
                <Field
                  orientation="horizontal"
                  className="rounded-lg border p-3"
                >
                  <FieldContent>
                    <FieldLabel htmlFor="tax-default">
                      Predeterminado
                    </FieldLabel>
                    <FieldDescription>
                      Se propondrá al facturar las estancias de este huésped.
                    </FieldDescription>
                  </FieldContent>
                  <Switch
                    id="tax-default"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isFirst || (isEdit && profile.isDefault)}
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
          <Button type="submit" form="tax-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
