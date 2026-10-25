import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { getErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useRoomTypes, useSaveRoom } from '../rooms-api';
import type { Room } from '../types';

const schema = z.object({
  number: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Escribe el número')
    .max(10, 'Máximo 10 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'Solo letras, números y guiones'),
  floor: z
    .number({ error: 'Escribe el piso' })
    .int('El piso debe ser un número entero')
    .min(-5, 'El piso no es válido')
    .max(200, 'El piso no es válido'),
  roomTypeId: z.string().min(1, 'Selecciona un tipo'),
  notes: z.string().max(500, 'Máximo 500 caracteres'),
  isActive: z.boolean(),
});

type Values = z.infer<typeof schema>;

export function RoomFormDialog({
  open,
  onOpenChange,
  room,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: Room | null;
}) {
  const isEdit = !!room;
  const { data: types = [] } = useRoomTypes();
  const saveRoom = useSaveRoom();
  const typeItems = types.map((t) => ({
    value: t.id,
    label: `${t.name} · ${formatMoney(t.nightlyRate)}`,
  }));

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      number: '',
      floor: 1,
      roomTypeId: '',
      notes: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      room
        ? {
            number: room.number,
            floor: room.floor,
            roomTypeId: room.roomType.id,
            notes: room.notes ?? '',
            isActive: room.isActive,
          }
        : {
            number: '',
            floor: 1,
            roomTypeId: types[0]?.id ?? '',
            notes: '',
            isActive: true,
          },
    );
  }, [open, room, types, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveRoom.mutateAsync({
        id: room?.id,
        number: values.number,
        floor: values.floor,
        roomTypeId: values.roomTypeId,
        notes: values.notes.trim() || null,
        ...(isEdit && { isActive: values.isActive }),
      });
      toast.success(
        isEdit
          ? `Habitación ${values.number} actualizada`
          : `Habitación ${values.number} creada`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar habitación ${room.number}` : 'Nueva habitación'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los datos de la habitación.'
              : 'Agrega una habitación al catálogo del hotel.'}
          </DialogDescription>
        </DialogHeader>

        <form id="room-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.number}>
                <FieldLabel htmlFor="room-number">Número</FieldLabel>
                <Input
                  id="room-number"
                  placeholder="101"
                  className="uppercase"
                  aria-invalid={!!errors.number}
                  {...register('number')}
                />
                <FieldError errors={[errors.number]} />
              </Field>
              <Field data-invalid={!!errors.floor}>
                <FieldLabel htmlFor="room-floor">Piso</FieldLabel>
                <Input
                  id="room-floor"
                  type="number"
                  aria-invalid={!!errors.floor}
                  {...register('floor', { valueAsNumber: true })}
                />
                <FieldError errors={[errors.floor]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.roomTypeId}>
              <FieldLabel htmlFor="room-type">Tipo de habitación</FieldLabel>
              <Controller
                control={control}
                name="roomTypeId"
                render={({ field }) => (
                  <Select
                    items={typeItems}
                    value={field.value}
                    onValueChange={(v) => v && field.onChange(v)}
                  >
                    <SelectTrigger id="room-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeItems.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {types.length === 0 && (
                <FieldDescription>
                  Primero crea un tipo de habitación.
                </FieldDescription>
              )}
              <FieldError errors={[errors.roomTypeId]} />
            </Field>

            <Field data-invalid={!!errors.notes}>
              <FieldLabel htmlFor="room-notes">Notas</FieldLabel>
              <Textarea
                id="room-notes"
                rows={2}
                placeholder="Ej. cerca del elevador"
                {...register('notes')}
              />
              <FieldError errors={[errors.notes]} />
            </Field>

            {isEdit && (
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="room-active">
                        Habitación activa
                      </FieldLabel>
                      <FieldDescription>
                        Desactívala si ya no se renta (no se borra su
                        historial).
                      </FieldDescription>
                    </FieldContent>
                    <Switch
                      id="room-active"
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
          <Button type="submit" form="room-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear habitación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
