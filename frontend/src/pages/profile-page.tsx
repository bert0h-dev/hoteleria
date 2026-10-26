import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '@/components/page-header';
import { RoleBadge } from '@/components/role-badge';
import { UserAvatar } from '@/components/user-avatar';
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import {
  useChangeOwnPassword,
  useUpdateProfile,
} from '@/features/auth/profile-api';
import type { User } from '@/features/auth/types';
import {
  nameField,
  passwordField,
  PASSWORD_MIN_LENGTH,
  phoneField,
} from '@/features/users/schemas';
import { getErrorMessage } from '@/lib/api';
import {
  formatDate,
  formatDateTime,
  formatDay,
  formatRelative,
} from '@/lib/format';
import { cn } from '@/lib/utils';

export function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi perfil"
        description="Tus datos y la seguridad de tu cuenta."
      />
      <ProfileHeader user={user} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PersonalDataForm user={user} />
        <PasswordForm />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProfileHeader({ user }: { user: User }) {
  const facts = [
    { icon: Mail, label: 'Correo', value: user.email },
    {
      icon: Hash,
      label: 'No. de empleado',
      value: user.employeeNumber ?? '—',
    },
    {
      icon: CalendarDays,
      label: 'Fecha de ingreso',
      value: user.hireDate ? formatDay(user.hireDate.slice(0, 10)) : '—',
    },
    {
      icon: BadgeCheck,
      label: 'Alta en el sistema',
      value: formatDate(user.createdAt),
    },
    {
      icon: Clock,
      label: 'Último acceso',
      value: formatRelative(user.lastLoginAt),
      title: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : undefined,
    },
  ];

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="relative h-24 bg-linear-to-br from-brand-from via-brand-via to-brand-to">
        <div className="absolute -top-10 right-10 size-40 rounded-full bg-brand-glow-1/40 blur-3xl" />
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
        <UserAvatar
          name={user.name}
          className="-mt-10 size-20 text-xl ring-4 ring-card"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="truncate text-xl font-semibold">{user.name}</h2>
          <RoleBadge role={user.role} />
        </div>
      </div>
      <dl className="grid gap-px border-t bg-border sm:grid-cols-2 lg:grid-cols-5">
        {facts.map(({ icon: Icon, label, value, title }) => (
          <div key={label} className="bg-card px-6 py-4" title={title}>
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5" />
              {label}
            </dt>
            <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

// ---------------------------------------------------------------------------

const personalSchema = z.object({ name: nameField, phone: phoneField });
type PersonalValues = z.infer<typeof personalSchema>;

function PersonalDataForm({ user }: { user: User }) {
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PersonalValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: { name: user.name, phone: user.phone ?? '' },
  });

  useEffect(
    () => reset({ name: user.name, phone: user.phone ?? '' }),
    [user, reset],
  );

  const onSubmit = handleSubmit(async (values) => {
    try {
      await update.mutateAsync({
        name: values.name,
        phone: values.phone || null,
      });
      toast.success('Datos actualizados');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" />
          Datos personales
        </CardTitle>
        <CardDescription>
          El correo, el rol y los datos de empleado los administra un
          administrador.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="profile-name">Nombre completo</FieldLabel>
              <Input
                id="profile-name"
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.phone}>
              <FieldLabel htmlFor="profile-phone">Teléfono</FieldLabel>
              <div className="relative">
                <Phone className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="profile-phone"
                  type="tel"
                  placeholder="998 123 4567"
                  className="pl-9"
                  aria-invalid={!!errors.phone}
                  {...register('phone')}
                />
              </div>
              <FieldError errors={[errors.phone]} />
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

// ---------------------------------------------------------------------------

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Escribe tu contraseña actual'),
    newPassword: passwordField,
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: 'Las contraseñas no coinciden',
  })
  .refine((v) => !v.newPassword || v.newPassword !== v.currentPassword, {
    path: ['newPassword'],
    message: 'La nueva contraseña debe ser distinta a la actual',
  });
type PasswordValues = z.infer<typeof passwordSchema>;

const EMPTY_PASSWORDS: PasswordValues = {
  currentPassword: '',
  newPassword: '',
  confirm: '',
};

function PasswordForm() {
  const change = useChangeOwnPassword();
  const [show, setShow] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: EMPTY_PASSWORDS,
  });
  const newPassword = useWatch({ control, name: 'newPassword' });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      toast.success('Contraseña actualizada', {
        description: 'Se cerraron tus sesiones en otros dispositivos.',
      });
      reset(EMPTY_PASSWORDS);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  });

  const type = show ? 'text' : 'password';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          Seguridad
        </CardTitle>
        <CardDescription>
          Al cambiar tu contraseña se cerrarán tus sesiones en otros
          dispositivos; esta seguirá abierta.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} noValidate>
        <CardContent>
          <FieldGroup className="gap-4">
            <Field data-invalid={!!errors.currentPassword}>
              <FieldLabel htmlFor="current-password">
                Contraseña actual
              </FieldLabel>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="current-password"
                  type={type}
                  autoComplete="current-password"
                  className="px-9"
                  aria-invalid={!!errors.currentPassword}
                  {...register('currentPassword')}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={
                    show ? 'Ocultar contraseñas' : 'Mostrar contraseñas'
                  }
                >
                  {show ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <FieldError errors={[errors.currentPassword]} />
            </Field>

            <Field data-invalid={!!errors.newPassword}>
              <FieldLabel htmlFor="new-password">Nueva contraseña</FieldLabel>
              <Input
                id="new-password"
                type={type}
                autoComplete="new-password"
                aria-invalid={!!errors.newPassword}
                {...register('newPassword')}
              />
              <PasswordStrength password={newPassword} />
              <FieldError errors={[errors.newPassword]} />
            </Field>

            <Field data-invalid={!!errors.confirm}>
              <FieldLabel htmlFor="confirm-new-password">
                Confirmar nueva contraseña
              </FieldLabel>
              <Input
                id="confirm-new-password"
                type={type}
                autoComplete="new-password"
                aria-invalid={!!errors.confirm}
                {...register('confirm')}
              />
              <FieldError errors={[errors.confirm]} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6 justify-end border-t pt-6">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Cambiar contraseña
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Indicador simple: largo, mayúsculas/minúsculas, números y símbolos. */
function passwordScore(password: string): number {
  if (password.length < PASSWORD_MIN_LENGTH) return password ? 1 : 0;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const STRENGTH = [
  { label: '', color: '' },
  { label: 'Débil', color: 'bg-destructive' },
  { label: 'Regular', color: 'bg-amber-500' },
  { label: 'Buena', color: 'bg-sky-500' },
  { label: 'Fuerte', color: 'bg-emerald-500' },
];

function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 rounded-full bg-muted transition-colors',
              score >= i && STRENGTH[score].color,
            )}
          />
        ))}
      </div>
      <FieldDescription>
        {score
          ? `Seguridad: ${STRENGTH[score].label}. `
          : `Mínimo ${PASSWORD_MIN_LENGTH} caracteres. `}
        Combina mayúsculas, minúsculas, números y símbolos.
      </FieldDescription>
    </div>
  );
}
