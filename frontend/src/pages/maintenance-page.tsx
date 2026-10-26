import { useState } from 'react';
import { Ban, Check, Loader2, Lock, Play, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  PRIORITIES,
  TICKET_STATUS,
  useCancelTicket,
  useResolveTicket,
  useStartTicket,
  useTickets,
  type Ticket,
} from '@/features/maintenance/maintenance-api';
import { ReportProblemDialog } from '@/features/maintenance/report-problem-dialog';
import { getErrorMessage } from '@/lib/api';
import { formatDayTime, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Tickets de mantenimiento (ADMIN y recepción). */
export function MaintenancePage() {
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const { data: tickets, isLoading } = useTickets(tab);
  const [creating, setCreating] = useState(false);
  const [closing, setClosing] = useState<{
    ticket: Ticket;
    mode: 'resolve' | 'cancel';
  } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mantenimiento"
        description="Problemas reportados en habitaciones y áreas del hotel."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Nuevo ticket
          </Button>
        }
      />

      <div className="flex gap-1.5">
        {(
          [
            ['open', 'Abiertos'],
            ['closed', 'Cerrados (30 días)'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={tab === value ? 'default' : 'outline'}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {isLoading && <Skeleton className="h-40 rounded-xl" />}
      {tickets?.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {tab === 'open'
            ? 'No hay tickets abiertos. 🎉'
            : 'No hay tickets cerrados en los últimos 30 días.'}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {tickets?.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            onClose={(mode) => setClosing({ ticket: t, mode })}
          />
        ))}
      </div>

      <ReportProblemDialog open={creating} onOpenChange={setCreating} />
      {closing && (
        <CloseDialog
          ticket={closing.ticket}
          mode={closing.mode}
          onDone={() => setClosing(null)}
        />
      )}
    </div>
  );
}

function TicketCard({
  ticket: t,
  onClose,
}: {
  ticket: Ticket;
  onClose: (mode: 'resolve' | 'cancel') => void;
}) {
  const start = useStartTicket();
  const open = t.status === 'OPEN' || t.status === 'IN_PROGRESS';

  const begin = async () => {
    try {
      await start.mutateAsync(t.id);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Card
      className={cn(
        'gap-3 p-4',
        t.priority === 'URGENT' && open && 'border-rose-500/40',
        t.status === 'IN_PROGRESS' && 'border-sky-500/50 bg-sky-500/5',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid min-w-12 shrink-0 place-items-center rounded-xl border-2 px-2 py-2 text-center text-sm font-bold tabular-nums">
          {t.room ? t.room.number : t.area}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                PRIORITIES[t.priority].className,
              )}
            >
              {PRIORITIES[t.priority].label}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">
              {TICKET_STATUS[t.status]}
            </span>
            {t.blocksRoom && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                <Lock className="size-3" />
                Bloquea
              </span>
            )}
          </p>
          <p className="font-medium">{t.description}</p>
          <p className="text-xs text-muted-foreground">
            Reportó {t.reportedBy.name} · {formatRelative(t.createdAt)}
          </p>
          {t.status === 'RESOLVED' && (
            <p className="text-sm">
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {t.fixedBy}:
              </span>{' '}
              {t.resolution}
              <span className="block text-xs text-muted-foreground">
                Cerró {t.resolvedBy?.name} ·{' '}
                {t.resolvedAt && formatDayTime(t.resolvedAt)}
              </span>
            </p>
          )}
          {t.status === 'CANCELLED' && (
            <p className="text-sm text-muted-foreground">
              Cancelado: {t.cancelReason}
            </p>
          )}
        </div>
      </div>
      {open && (
        <div className="flex gap-2">
          {t.status === 'OPEN' && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={begin}
              disabled={start.isPending}
            >
              <Play />
              En proceso
            </Button>
          )}
          <Button
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => onClose('resolve')}
          >
            <Check />
            Resolver
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancelar ticket"
            onClick={() => onClose('cancel')}
          >
            <X />
          </Button>
        </div>
      )}
    </Card>
  );
}

function CloseDialog({
  ticket,
  mode,
  onDone,
}: {
  ticket: Ticket;
  mode: 'resolve' | 'cancel';
  onDone: () => void;
}) {
  const resolve = useResolveTicket();
  const cancel = useCancelTicket();
  const [text, setText] = useState('');
  const [fixedBy, setFixedBy] = useState('');
  const pending = resolve.isPending || cancel.isPending;
  const place = ticket.room ? `Hab. ${ticket.room.number}` : ticket.area;

  const submit = async () => {
    if (!text.trim())
      return toast.error(
        mode === 'resolve' ? 'Describe la solución' : 'Indica el motivo',
      );
    if (mode === 'resolve' && !fixedBy.trim())
      return toast.error('Indica quién lo arregló');
    try {
      const result =
        mode === 'resolve'
          ? await resolve.mutateAsync({
              id: ticket.id,
              resolution: text.trim(),
              fixedBy: fixedBy.trim(),
            })
          : await cancel.mutateAsync({ id: ticket.id, reason: text.trim() });
      toast.success(
        mode === 'resolve' ? 'Ticket resuelto' : 'Ticket cancelado',
        {
          description: result.roomReleased
            ? `La habitación ${ticket.room?.number} pasó a Limpieza`
            : undefined,
        },
      );
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'resolve' ? 'Resolver' : 'Cancelar'} · {place}
          </DialogTitle>
          <DialogDescription>{ticket.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {mode === 'resolve' && (
            <div className="space-y-1.5">
              <Label htmlFor="fixed-by">¿Quién lo arregló?</Label>
              <Input
                id="fixed-by"
                autoFocus
                maxLength={80}
                value={fixedBy}
                onChange={(e) => setFixedBy(e.target.value)}
                placeholder="Plomero Juan, técnico de A/C…"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="close-text">
              {mode === 'resolve' ? '¿Qué se hizo?' : 'Motivo'}
            </Label>
            <Textarea
              id="close-text"
              rows={2}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          {ticket.blocksRoom && (
            <p className="text-xs text-muted-foreground">
              Al cerrarlo, la habitación pasa a Limpieza (si no hay otro ticket
              que la bloquee).
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>
            Volver
          </Button>
          <Button
            variant={mode === 'cancel' ? 'destructive' : 'default'}
            onClick={submit}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="animate-spin" />
            ) : mode === 'resolve' ? (
              <Check />
            ) : (
              <Ban />
            )}
            {mode === 'resolve' ? 'Resolver' : 'Cancelar ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
