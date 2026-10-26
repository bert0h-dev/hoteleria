import { useState } from 'react';
import {
  Ban,
  CalendarDays,
  Cake,
  FileText,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  StickyNote,
  Star,
  Trash2,
  Unlock,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/user-avatar';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/auth-context';
import { getErrorMessage } from '@/lib/api';
import { formatDate, formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { countryFlag, countryName } from '../countries';
import {
  useBlockGuest,
  useDeleteTaxProfile,
  useGuest,
  useSatCatalogs,
} from '../guests-api';
import {
  DOCUMENT_TYPES,
  fullName,
  type Guest,
  type TaxProfile,
} from '../types';
import { GuestBadges } from './guest-badges';
import { GuestFormDialog } from './guest-form-dialog';
import { TaxProfileFormDialog } from './tax-profile-form-dialog';

/** Ficha del huésped en un diálogo centrado. */
export function GuestDetailsDialog({
  guestId,
  onOpenChange,
}: {
  guestId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: guest, isLoading } = useGuest(guestId);

  return (
    <Dialog open={!!guestId} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92svh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {isLoading || !guest ? (
          <div className="space-y-4 p-6">
            <DialogTitle className="sr-only">Cargando huésped</DialogTitle>
            <Skeleton className="h-16 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <GuestDetails guest={guest} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function GuestDetails({ guest }: { guest: Guest }) {
  const { hasRole } = useAuth();
  const [editing, setEditing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const name = fullName(guest);

  const origin = [guest.city, guest.state].filter(Boolean).join(', ');
  const info = [
    { icon: Phone, label: 'Teléfono', value: guest.phone },
    { icon: Mail, label: 'Correo', value: guest.email },
    {
      icon: IdCard,
      label: 'Identificación',
      value:
        guest.documentType &&
        `${DOCUMENT_TYPES[guest.documentType]} · ${guest.documentNumber}`,
    },
    {
      icon: Cake,
      label: 'Nacimiento',
      value: guest.birthDate && formatDay(guest.birthDate),
    },
    {
      icon: MapPin,
      label: 'Procedencia',
      value:
        (origin || guest.country) &&
        `${origin}${origin && guest.country ? ' · ' : ''}${
          guest.country
            ? `${countryFlag(guest.country)} ${countryName(guest.country)}`
            : ''
        }`,
    },
    {
      icon: ShieldCheck,
      label: 'Aviso de privacidad',
      value: guest.privacyAcceptedAt
        ? `Aceptado el ${formatDate(guest.privacyAcceptedAt)}`
        : 'Pendiente',
    },
  ];

  return (
    <>
      <DialogHeader className="relative shrink-0 overflow-hidden border-b p-6">
        <div className="absolute -top-16 -right-16 size-48 rounded-full bg-brand-glow-1/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar name={name} className="size-16 text-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-lg">
              {name}
              <GuestBadges guest={guest} />
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              {guest.nationality && (
                <span>
                  {countryFlag(guest.nationality)}{' '}
                  {countryName(guest.nationality)} ·
                </span>
              )}
              Registrado el {formatDate(guest.createdAt)}
            </DialogDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil />
              Editar
            </Button>
            {hasRole('ADMIN') && (
              <Button
                variant={guest.isBlocked ? 'outline' : 'destructive'}
                size="sm"
                onClick={() => setBlocking(true)}
              >
                {guest.isBlocked ? <Unlock /> : <Ban />}
                {guest.isBlocked ? 'Desbloquear' : 'Bloquear'}
              </Button>
            )}
          </div>
        </div>
      </DialogHeader>

      <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2 md:grid-rows-1 md:overflow-hidden">
        <div className="min-h-0 space-y-5 p-6 md:overflow-y-auto">
          {guest.isBlocked && (
            <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <Ban className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">
                  No se le puede rentar
                </p>
                <p className="text-muted-foreground">{guest.blockedReason}</p>
              </div>
            </div>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            {info.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-lg border bg-muted/30 p-3">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5" />
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-medium break-words">
                  {value || <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
            ))}
          </dl>

          {guest.notes && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                <StickyNote className="size-3.5" />
                Notas y preferencias
              </p>
              <p className="mt-1 text-sm whitespace-pre-line">{guest.notes}</p>
            </div>
          )}

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-primary" />
              Estancias
            </h3>
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              El historial de estancias aparecerá aquí cuando lleguen las
              reservas (Fase 5).
            </p>
          </section>
        </div>

        <div className="min-h-0 border-t bg-muted/20 p-6 md:overflow-y-auto md:border-t-0 md:border-l">
          <TaxProfiles guest={guest} />
        </div>
      </div>

      <GuestFormDialog open={editing} onOpenChange={setEditing} guest={guest} />
      <BlockDialog guest={guest} open={blocking} onOpenChange={setBlocking} />
    </>
  );
}

function TaxProfiles({ guest }: { guest: Guest }) {
  const profiles = guest.taxProfiles ?? [];
  const { data: catalogs } = useSatCatalogs();
  const remove = useDeleteTaxProfile(guest.id);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaxProfile | null>(null);
  const [deleting, setDeleting] = useState<TaxProfile | null>(null);

  const regimeName = (code: string) =>
    catalogs?.taxRegimes.find((r) => r.code === code)?.name ?? '';
  const cfdiUseName = (code: string) =>
    catalogs?.cfdiUses.find((u) => u.code === code)?.name ?? '';

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Datos fiscales eliminados');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primary" />
          Datos fiscales
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus />
          Agregar
        </Button>
      </div>

      {profiles.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Sin datos fiscales. Agrégalos si el huésped requiere factura.
        </p>
      )}

      <ul className="space-y-3">
        {profiles.map((p) => (
          <li
            key={p.id}
            className={cn(
              'space-y-2 rounded-xl border bg-card p-4',
              p.isDefault && 'border-primary/40 ring-1 ring-primary/20',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-mono text-sm font-semibold">
                  {p.rfc}
                  {p.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[10px] font-medium text-primary">
                      <Star className="size-3" />
                      Predeterminado
                    </span>
                  )}
                </p>
                <p className="truncate text-sm">{p.legalName}</p>
              </div>
              <div className="flex shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar ${p.rfc}`}
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
                  aria-label={`Eliminar ${p.rfc}`}
                  onClick={() => setDeleting(p)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Régimen</dt>
              <dd className="truncate" title={regimeName(p.taxRegime)}>
                {p.taxRegime} · {regimeName(p.taxRegime)}
              </dd>
              <dt className="text-muted-foreground">Uso de CFDI</dt>
              <dd className="truncate">
                {p.cfdiUse} · {cfdiUseName(p.cfdiUse)}
              </dd>
              <dt className="text-muted-foreground">C.P. fiscal</dt>
              <dd>{p.zipCode}</dd>
              {p.invoiceEmail && (
                <>
                  <dt className="text-muted-foreground">Correo</dt>
                  <dd className="truncate">{p.invoiceEmail}</dd>
                </>
              )}
            </dl>
          </li>
        ))}
      </ul>

      <TaxProfileFormDialog
        guestId={guest.id}
        open={formOpen}
        onOpenChange={setFormOpen}
        profile={editing}
        isFirst={profiles.length === 0}
        defaultEmail={guest.email}
      />

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar estos datos fiscales?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el RFC {deleting?.rfc} de este huésped.
              {deleting?.isDefault &&
                ' Otro perfil quedará como predeterminado.'}
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
    </section>
  );
}

function BlockDialog({
  guest,
  open,
  onOpenChange,
}: {
  guest: Guest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const block = useBlockGuest();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const blocking = !guest.isBlocked;

  const submit = async () => {
    if (blocking && !reason.trim()) {
      setError('Escribe el motivo del bloqueo');
      return;
    }
    try {
      await block.mutateAsync({
        id: guest.id,
        isBlocked: blocking,
        reason: blocking ? reason.trim() : undefined,
      });
      toast.success(blocking ? 'Huésped bloqueado' : 'Huésped desbloqueado');
      setReason('');
      setError(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {blocking
              ? '¿Bloquear a este huésped?'
              : '¿Desbloquear a este huésped?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {blocking
              ? `${fullName(guest)} no podrá tener nuevas reservas ni estancias.`
              : `${fullName(guest)} podrá volver a hospedarse.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {blocking && (
          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Motivo</Label>
            <Textarea
              id="block-reason"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. daños a la habitación"
              aria-invalid={!!error}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant={blocking ? 'destructive' : 'default'}
            onClick={submit}
            disabled={block.isPending}
          >
            {block.isPending && <Loader2 className="animate-spin" />}
            {blocking ? 'Bloquear' : 'Desbloquear'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
