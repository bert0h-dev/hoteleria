import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Loader2 } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useHotel } from '@/features/hotel/hotel-api';
import { calculateRates } from '@/features/hotel/pricing';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AMENITIES, AMENITY_LIST } from '../amenities';
import { useSaveRoomType } from '../rooms-api';
import type { Amenity, RoomType } from '../types';
import { RatesGrid } from './rates-grid';

const int = (label: string, min: number, max: number) =>
  z
    .number({ error: `Escribe ${label}` })
    .int(`${label[0].toUpperCase()}${label.slice(1)} debe ser un número entero`)
    .min(min, `Mínimo ${min}`)
    .max(max, `Máximo ${max}`);

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre')
    .max(80, 'Máximo 80 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres'),
  maxAdults: int('la capacidad de adultos', 1, 20),
  maxChildren: int('la capacidad de niños', 0, 20),
  nightlyRate: z
    .number({ error: 'Escribe el precio por noche' })
    .int('El precio debe ser en pesos enteros (sin centavos)')
    .min(1, 'El precio debe ser mayor a 0')
    .max(1_000_000, 'El precio es demasiado alto'),
  amenities: z.array(z.string()),
  isActive: z.boolean(),
});

type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  name: '',
  description: '',
  maxAdults: 2,
  maxChildren: 0,
  nightlyRate: 1000,
  amenities: ['WIFI', 'AIR_CONDITIONING', 'TV'],
  isActive: true,
};

export function RoomTypeFormDialog({
  open,
  onOpenChange,
  roomType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomType?: RoomType | null;
}) {
  const isEdit = !!roomType;
  const { data: hotel } = useHotel();
  const save = useSaveRoomType();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    reset(
      roomType
        ? {
            name: roomType.name,
            description: roomType.description ?? '',
            maxAdults: roomType.maxAdults,
            maxChildren: roomType.maxChildren,
            nightlyRate: roomType.nightlyRate,
            amenities: roomType.amenities,
            isActive: roomType.isActive,
          }
        : EMPTY,
    );
  }, [open, roomType, reset]);

  const nightlyRate = useWatch({ control, name: 'nightlyRate' });
  const validRate = Number.isInteger(nightlyRate) && nightlyRate > 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await save.mutateAsync({
        id: roomType?.id,
        name: values.name,
        description: values.description.trim() || null,
        maxAdults: values.maxAdults,
        maxChildren: values.maxChildren,
        nightlyRate: values.nightlyRate,
        amenities: values.amenities as Amenity[],
        ...(isEdit && { isActive: values.isActive }),
      });
      toast.success(isEdit ? 'Tipo actualizado' : 'Tipo de habitación creado');
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar «${roomType.name}»` : 'Nuevo tipo de habitación'}
          </DialogTitle>
          <DialogDescription>
            Solo capturas el precio por noche; las demás tarifas se calculan con
            la configuración del hotel.
          </DialogDescription>
        </DialogHeader>

        <form id="room-type-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="rt-name">Nombre</FieldLabel>
              <Input
                id="rt-name"
                placeholder="Doble estándar"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="rt-description">Descripción</FieldLabel>
              <Textarea
                id="rt-description"
                rows={2}
                placeholder="Dos camas matrimoniales, ideal para familias."
                {...register('description')}
              />
              <FieldError errors={[errors.description]} />
            </Field>

            <div className="grid grid-cols-3 gap-4">
              <Field data-invalid={!!errors.maxAdults}>
                <FieldLabel htmlFor="rt-adults">Adultos</FieldLabel>
                <Input
                  id="rt-adults"
                  type="number"
                  min={1}
                  aria-invalid={!!errors.maxAdults}
                  {...register('maxAdults', { valueAsNumber: true })}
                />
                <FieldError errors={[errors.maxAdults]} />
              </Field>
              <Field data-invalid={!!errors.maxChildren}>
                <FieldLabel htmlFor="rt-children">Niños</FieldLabel>
                <Input
                  id="rt-children"
                  type="number"
                  min={0}
                  aria-invalid={!!errors.maxChildren}
                  {...register('maxChildren', { valueAsNumber: true })}
                />
                <FieldError errors={[errors.maxChildren]} />
              </Field>
              <Field data-invalid={!!errors.nightlyRate}>
                <FieldLabel htmlFor="rt-rate">Precio / noche</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="rt-rate"
                    type="number"
                    min={1}
                    step={1}
                    className="pl-6"
                    aria-invalid={!!errors.nightlyRate}
                    {...register('nightlyRate', { valueAsNumber: true })}
                  />
                </div>
                <FieldError errors={[errors.nightlyRate]} />
              </Field>
            </div>

            {hotel && (
              <div className="space-y-2 rounded-xl border border-dashed bg-muted/20 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Tarifas calculadas
                </p>
                {validRate ? (
                  <RatesGrid
                    rates={calculateRates(nightlyRate, hotel.settings)}
                    settings={hotel.settings}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Escribe un precio por noche en pesos enteros.
                  </p>
                )}
              </div>
            )}

            <Field>
              <FieldLabel>Amenidades</FieldLabel>
              <Controller
                control={control}
                name="amenities"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-2">
                    {AMENITY_LIST.map((a) => {
                      const { label, icon: Icon } = AMENITIES[a];
                      const selected = field.value.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            field.onChange(
                              selected
                                ? field.value.filter((x) => x !== a)
                                : [...field.value, a],
                            )
                          }
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted',
                            selected &&
                              'border-primary bg-primary/10 text-primary hover:bg-primary/15',
                          )}
                        >
                          {selected ? (
                            <Check className="size-3" />
                          ) : (
                            <Icon className="size-3" />
                          )}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </Field>

            {isEdit && (
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="rt-active">Tipo activo</FieldLabel>
                      <FieldDescription>
                        Los tipos inactivos no se ofrecen al crear habitaciones.
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="rt-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </Field>
                )}
              />
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="room-type-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear tipo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
