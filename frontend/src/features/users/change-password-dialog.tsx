import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Loader2 } from 'lucide-react';
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { User } from '@/features/auth/types';
import { getErrorMessage } from '@/lib/api';
import {
  changePasswordSchema,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordValues,
} from './schemas';
import { useChangePassword } from './users-api';

export function ChangePasswordDialog({
  user,
  onOpenChange,
}: {
  user: User | null;
  onOpenChange: (open: boolean) => void;
}) {
  const changePassword = useChangePassword();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    if (user) reset();
  }, [user, reset]);

  const onSubmit = handleSubmit(async ({ password }) => {
    if (!user) return;
    try {
      await changePassword.mutateAsync({ id: user.id, password });
      toast.success('Contraseña actualizada', {
        description: 'Se cerraron las sesiones abiertas del usuario.',
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Nueva contraseña para <strong>{user?.name}</strong>. Se cerrarán
            todas sus sesiones abiertas.
          </DialogDescription>
        </DialogHeader>

        <form id="password-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
              <Input
                id="new-password"
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
            <Field data-invalid={!!errors.confirm}>
              <FieldLabel htmlFor="confirm-password">
                Confirmar contraseña
              </FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirm}
                {...register('confirm')}
              />
              <FieldError errors={[errors.confirm]} />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="password-form" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Actualizar contraseña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
