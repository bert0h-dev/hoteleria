import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router';
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { z } from 'zod';
import { Logo, LogoMark } from '@/components/logo';
import { ThemePicker } from '@/features/theme/theme-picker';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { getErrorMessage } from '@/lib/api';

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo')
    .pipe(z.email('El correo no es válido')),
  password: z.string().min(1, 'Escribe tu contraseña'),
});

type LoginValues = z.infer<typeof loginSchema>;

const CURRENT_YEAR = new Date().getFullYear();

const HIGHLIGHTS = [
  {
    icon: CalendarCheck,
    title: 'Reservas sin fricción',
    text: 'Disponibilidad en tiempo real y cero dobles reservas.',
  },
  {
    icon: Sparkles,
    title: 'Operación al día',
    text: 'Llegadas, salidas y limpieza en un solo lugar.',
  },
  {
    icon: ShieldCheck,
    title: 'Acceso por roles',
    text: 'Cada quien ve exactamente lo que necesita.',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      await login(email, password);
      const from = (location.state as { from?: Location } | null)?.from;
      navigate(from?.pathname ?? '/', { replace: true });
    } catch (error) {
      setServerError(getErrorMessage(error));
    }
  });

  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-brand-deep p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-linear-to-br from-brand-from via-brand-via to-brand-deep" />
        <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-brand-glow-1/40 blur-3xl" />
        <div className="absolute -right-20 bottom-0 size-[32rem] rounded-full bg-brand-glow-2/30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.15] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative flex items-center gap-3">
          <LogoMark className="bg-white/15 from-white/20 to-white/5 shadow-none ring-white/30 backdrop-blur" />
          <span className="text-lg font-semibold tracking-tight">
            Hotelería
          </span>
        </div>

        <div className="relative my-auto max-w-lg space-y-10">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20 backdrop-blur">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Sistema de gestión hotelera
            </span>
            <h1 className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
              Tu hotel, en orden y{' '}
              <span className="bg-linear-to-r from-white to-white/60 bg-clip-text text-transparent">
                bajo control.
              </span>
            </h1>
            <p className="text-lg text-white/80">
              Recepción, reservas, habitaciones y cobros desde un mismo panel.
            </p>
          </div>

          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-white/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/60">
          © {CURRENT_YEAR} Hotelería
        </p>
      </aside>

      {/* Formulario */}
      <main className="relative flex flex-col p-6 sm:p-10">
        <div className="flex items-center justify-between">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="ml-auto">
            <ThemePicker />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-8 space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight">
              Bienvenido de nuevo
            </h2>
            <p className="text-muted-foreground">
              Inicia sesión para continuar con tu turno.
            </p>
          </div>

          <form onSubmit={onSubmit} noValidate>
            <FieldGroup className="gap-5">
              {serverError && (
                <div
                  role="alert"
                  className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p>{serverError}</p>
                </div>
              )}

              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="tu@correo.com"
                    className="h-11 pl-10"
                    aria-invalid={!!errors.email}
                    {...register('email')}
                  />
                </div>
                <FieldError errors={[errors.email]} />
              </Field>

              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-11 px-10"
                    aria-invalid={!!errors.password}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <FieldError errors={[errors.password]} />
              </Field>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="group h-11 w-full bg-linear-to-r from-brand-from to-brand-to text-white shadow-lg shadow-brand-from/25 hover:brightness-110"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Entrando…
                  </>
                ) : (
                  <>
                    Iniciar sesión
                    <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>
            </FieldGroup>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            ¿Olvidaste tu contraseña? Pide a un administrador que la
            restablezca.
          </p>
        </div>
      </main>
    </div>
  );
}
