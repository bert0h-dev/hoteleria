import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
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
import { useAuth } from '@/features/auth/auth-context';
import type { User } from '@/features/auth/types';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { RoleSelect } from './role-select';
import {
  createUserSchema,
  editUserSchema,
  PASSWORD_MIN_LENGTH,
  type CreateUserValues,
} from './schemas';
import { useCreateUser, useUpdateUser } from './users-api';

const EMPTY: CreateUserValues = {
  name: '',
  email: '',
  role: 'RECEPTION',
  password: '',
  phone: '',
  employeeNumber: '',
  hireDate: '',
  canAuthorize: false,
  canDiscountUnlimited: false,
};

/** Crea un usuario (sin `user`) o edita uno existente. */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
}) {
  const isEdit = !!user;
  const { user: me } = useAuth();
  const isSelf = user?.id === me?.id;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserValues>({
    // En edición no se valida correo ni contraseña.
    resolver: zodResolver(
      (isEdit ? editUserSchema : createUserSchema) as typeof createUserSchema,
    ),
    defaultValues: EMPTY,
  });
  // Con rol de limpieza, los permisos de cobro se deshabilitan.
  const isHousekeeping = useWatch({ control, name: 'role' }) === 'HOUSEKEEPING';

  useEffect(() => {
    if (open) {
      reset(
        user
          ? {
              ...EMPTY,
              name: user.name,
              email: user.email,
              role: user.role,
              phone: user.phone ?? '',
              employeeNumber: user.employeeNumber ?? '',
              hireDate: user.hireDate?.slice(0, 10) ?? '',
              canAuthorize: user.canAuthorize,
              canDiscountUnlimited: user.canDiscountUnlimited,
            }
          : EMPTY,
      );
    }
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    // Los campos opcionales vacíos se guardan como null.
    const employee = {
      phone: values.phone || null,
      employeeNumber: values.employeeNumber || null,
      hireDate: values.hireDate || null,
    };
    try {
      if (user) {
        await updateUser.mutateAsync({
          id: user.id,
          name: values.name,
          role: values.role,
          ...employee,
          // Limpieza nunca tiene permisos de cobro.
          canAuthorize: values.role !== 'HOUSEKEEPING' && values.canAuthorize,
          canDiscountUnlimited:
            values.role !== 'HOUSEKEEPING' && values.canDiscountUnlimited,
        });
        toast.success('Usuario actualizado');
      } else {
        await createUser.mutateAsync({
          name: values.name,
          email: values.email,
          role: values.role,
          password: values.password,
          ...employee,
        });
        toast.success('Usuario creado', {
          description: `${values.name} ya puede iniciar sesión.`,
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar usuario' : 'Nuevo usuario'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza el nombre o el rol del usuario.'
              : 'Crea una cuenta para un miembro del equipo.'}
          </DialogDescription>
        </DialogHeader>

        <form id="user-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="user-name">Nombre completo</FieldLabel>
              <Input
                id="user-name"
                placeholder="Ana López"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="user-email">Correo electrónico</FieldLabel>
              <Input
                id="user-email"
                type="email"
                placeholder="ana@mihotel.com"
                disabled={isEdit}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {isEdit && (
                <FieldDescription>
                  El correo no se puede cambiar.
                </FieldDescription>
              )}
              <FieldError errors={[errors.email]} />
            </Field>

            <Field data-invalid={!!errors.role}>
              <FieldLabel htmlFor="user-role">Rol</FieldLabel>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <RoleSelect
                    id="user-role"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isSelf}
                    invalid={!!errors.role}
                  />
                )}
              />
              {isSelf && (
                <FieldDescription>
                  No puedes cambiar tu propio rol.
                </FieldDescription>
              )}
              <FieldError errors={[errors.role]} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.phone} className="col-span-2">
                <FieldLabel htmlFor="user-phone">
                  Teléfono{' '}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </FieldLabel>
                <Input
                  id="user-phone"
                  type="tel"
                  placeholder="998 123 4567"
                  aria-invalid={!!errors.phone}
                  {...register('phone')}
                />
                <FieldError errors={[errors.phone]} />
              </Field>
              <Field data-invalid={!!errors.employeeNumber}>
                <FieldLabel htmlFor="user-employee">No. de empleado</FieldLabel>
                <Input
                  id="user-employee"
                  placeholder="EMP-014"
                  className="uppercase"
                  aria-invalid={!!errors.employeeNumber}
                  {...register('employeeNumber')}
                />
                <FieldError errors={[errors.employeeNumber]} />
              </Field>
              <Field data-invalid={!!errors.hireDate}>
                <FieldLabel htmlFor="user-hire">Fecha de ingreso</FieldLabel>
                <Input id="user-hire" type="date" {...register('hireDate')} />
                <FieldError errors={[errors.hireDate]} />
              </Field>
            </div>

            {isEdit && (
              <div
                className={cn(
                  'space-y-2 rounded-xl border p-3',
                  isHousekeeping && 'bg-muted/40',
                )}
              >
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Permisos de cobro
                </p>
                {isHousekeeping && (
                  <p className="text-xs text-muted-foreground">
                    El personal de limpieza no cobra ni autoriza; estos permisos
                    no aplican a su rol.
                  </p>
                )}
                <Controller
                  control={control}
                  name="canAuthorize"
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor="perm-authorize">
                          Puede autorizar
                        </FieldLabel>
                        <FieldDescription>
                          Autoriza con su PIN descuentos sobre el tope,
                          condonaciones y salidas con saldo.
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="perm-authorize"
                        checked={!isHousekeeping && field.value}
                        disabled={isHousekeeping}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
                <Controller
                  control={control}
                  name="canDiscountUnlimited"
                  render={({ field }) => (
                    <Field orientation="horizontal">
                      <FieldContent>
                        <FieldLabel htmlFor="perm-discount">
                          Descuentos sin límite
                        </FieldLabel>
                        <FieldDescription>
                          Aplica descuentos sin pedir autorización.
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="perm-discount"
                        checked={!isHousekeeping && field.value}
                        disabled={isHousekeeping}
                        onCheckedChange={field.onChange}
                      />
                    </Field>
                  )}
                />
              </div>
            )}

            {!isEdit && (
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="user-password">
                  Contraseña inicial
                </FieldLabel>
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <FieldDescription>
                  Mínimo {PASSWORD_MIN_LENGTH} caracteres.
                </FieldDescription>
                <FieldError errors={[errors.password]} />
              </Field>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="user-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isEdit ? 'Guardar cambios' : 'Crear usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
