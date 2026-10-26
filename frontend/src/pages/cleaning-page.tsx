import { useState } from 'react';
import {
  Check,
  Flame,
  Hand,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/auth-context';
import {
  CLEANING_KINDS,
  useCancelTask,
  useCleaningTasks,
  useCreateStayover,
  useTaskAction,
  useUpdateTask,
  type CleaningTask,
} from '@/features/cleaning/cleaning-api';
import { useHousekeepers, useRooms } from '@/features/rooms/rooms-api';
import { ReportProblemDialog } from '@/features/maintenance/report-problem-dialog';
import { getErrorMessage } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const UNASSIGNED = 'none';

export function CleaningPage() {
  const { user, hasRole } = useAuth();
  const manager = hasRole('ADMIN', 'RECEPTION');
  const { data: tasks, isLoading } = useCleaningTasks('active');
  const { data: done } = useCleaningTasks('done');
  const [creating, setCreating] = useState(false);

  const mine = tasks?.filter((t) => t.assignedTo?.id === user?.id) ?? [];
  const free = tasks?.filter((t) => !t.assignedTo) ?? [];
  const byPerson = new Map<string, CleaningTask[]>();
  for (const t of tasks ?? []) {
    if (!t.assignedTo) continue;
    byPerson.set(t.assignedTo.name, [
      ...(byPerson.get(t.assignedTo.name) ?? []),
      t,
    ]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={manager ? 'Limpieza' : 'Mis tareas'}
        description={
          manager
            ? 'Asigna las limpiezas o deja que el personal las tome de la lista.'
            : 'Toma una habitación, empieza y marca cuando termines.'
        }
        actions={
          manager && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Pedir repaso
            </Button>
          )
        }
      />

      {isLoading && <Skeleton className="h-40 rounded-xl" />}

      {!manager && tasks && (
        <>
          <Section title="Mis tareas" count={mine.length}>
            {mine.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
            {mine.length === 0 && <Empty text="No tienes tareas asignadas." />}
          </Section>
          <Section title="Disponibles para tomar" count={free.length}>
            {free.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
            {free.length === 0 && <Empty text="No hay habitaciones libres." />}
          </Section>
        </>
      )}

      {manager && tasks && (
        <>
          <Section title="Sin asignar" count={free.length}>
            {free.map((t) => (
              <TaskCard key={t.id} task={t} manager />
            ))}
            {free.length === 0 && <Empty text="Todo está asignado." />}
          </Section>
          {[...byPerson].map(([name, list]) => (
            <Section key={name} title={name} count={list.length}>
              {list.map((t) => (
                <TaskCard key={t.id} task={t} manager />
              ))}
            </Section>
          ))}
        </>
      )}

      {done && done.length > 0 && (
        <Section
          title={manager ? 'Terminadas hoy' : 'Mis limpiezas de hoy'}
          count={done.length}
        >
          {done.map((t) => (
            <Card
              key={t.id}
              className="flex-row items-center gap-3 p-3 opacity-80"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/15 font-bold text-emerald-700 tabular-nums dark:text-emerald-300">
                {t.room.number}
              </span>
              <span className="flex-1 text-sm">
                {CLEANING_KINDS[t.kind]} · {t.finishedBy?.name}
                <span className="block text-xs text-muted-foreground">
                  {formatRelative(t.finishedAt)}
                  {t.startedAt &&
                    t.finishedAt &&
                    ` · ${minutes(t.startedAt, t.finishedAt)} min`}
                </span>
              </span>
              <Check className="size-4 text-emerald-600" />
            </Card>
          ))}
        </Section>
      )}

      {manager && <StayoverDialog open={creating} onOpenChange={setCreating} />}
    </div>
  );
}

const minutes = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {count}
        </span>
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
      {text}
    </p>
  );
}

function TaskCard({
  task: t,
  manager,
}: {
  task: CleaningTask;
  manager?: boolean;
}) {
  const { user } = useAuth();
  const action = useTaskAction();
  const [cancelling, setCancelling] = useState(false);
  const [reporting, setReporting] = useState(false);
  const inProgress = t.status === 'IN_PROGRESS';
  const mineOrFree = !t.assignedTo || t.assignedTo.id === user?.id;

  const run = async (kind: 'take' | 'start' | 'finish') => {
    try {
      await action.mutateAsync({ id: t.id, action: kind });
      if (kind === 'finish') toast.success(`Habitación ${t.room.number} lista`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Card
      className={cn(
        'gap-3 p-4',
        t.isPriority && 'border-rose-500/40',
        inProgress && 'border-sky-500/50 bg-sky-500/5',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-xl border-2 text-xl font-bold tabular-nums',
            t.kind === 'DEPARTURE'
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-violet-500/50 bg-violet-500/10',
          )}
        >
          {t.room.number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {CLEANING_KINDS[t.kind]}
            {t.isPriority && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-xs text-rose-700 dark:text-rose-300">
                <Flame className="size-3" />
                Prioridad
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {t.room.roomType.name} · piso {t.room.floor} ·{' '}
            {inProgress
              ? `en proceso ${formatRelative(t.startedAt)}`
              : `pendiente ${formatRelative(t.createdAt)}`}
          </p>
          {t.notes && <p className="mt-1 text-sm">“{t.notes}”</p>}
        </div>
      </div>

      {manager && <AssignSelect task={t} />}

      <div className="flex gap-2">
        {!manager && !t.assignedTo && !inProgress && (
          <Button
            variant="outline"
            className="h-11 flex-1"
            onClick={() => run('take')}
            disabled={action.isPending}
          >
            <Hand />
            Tomar
          </Button>
        )}
        {(manager || mineOrFree) && !inProgress && (
          <Button
            variant={manager ? 'outline' : 'default'}
            className={cn('flex-1', !manager && 'h-11')}
            onClick={() => run('start')}
            disabled={action.isPending}
          >
            <Play />
            Empezar
          </Button>
        )}
        {(manager || mineOrFree) && (
          <Button
            className={cn(
              'flex-1 bg-emerald-600 text-white hover:bg-emerald-600/90',
              !manager && 'h-11',
            )}
            onClick={() => run('finish')}
            disabled={action.isPending}
          >
            {action.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Check />
            )}
            Terminar
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(!manager && 'size-11')}
          aria-label="Reportar problema"
          title="Reportar problema"
          onClick={() => setReporting(true)}
        >
          <Wrench />
        </Button>
        {manager && t.kind === 'STAYOVER' && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancelar repaso"
            onClick={() => setCancelling(true)}
          >
            <X />
          </Button>
        )}
      </div>
      <ReportProblemDialog
        open={reporting}
        onOpenChange={setReporting}
        room={t.room}
      />
      {cancelling && (
        <CancelDialog task={t} onClose={() => setCancelling(false)} />
      )}
    </Card>
  );
}

function AssignSelect({ task: t }: { task: CleaningTask }) {
  const { data: people } = useHousekeepers(true);
  const update = useUpdateTask();
  const value = t.assignedTo?.id ?? UNASSIGNED;

  const change = async (v: string | null) => {
    try {
      await update.mutateAsync({
        id: t.id,
        assignedToId: !v || v === UNASSIGNED ? null : v,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger className="h-8 w-full text-xs">
        <SelectValue>
          {(v: string) =>
            v === UNASSIGNED
              ? 'Sin asignar (cualquiera la puede tomar)'
              : (people?.find((p) => p.id === v)?.name ?? t.assignedTo?.name)
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
        {people?.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CancelDialog({
  task,
  onClose,
}: {
  task: CleaningTask;
  onClose: () => void;
}) {
  const cancel = useCancelTask();
  const [reason, setReason] = useState('');
  const submit = async () => {
    if (!reason.trim()) return toast.error('Indica el motivo');
    try {
      await cancel.mutateAsync({ id: task.id, reason: reason.trim() });
      toast.success('Repaso cancelado');
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancelar repaso · {task.room.number}</DialogTitle>
          <DialogDescription>Indica por qué ya no se hará.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="El huésped no quiso el servicio"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={cancel.isPending}
          >
            Cancelar repaso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StayoverDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && <StayoverForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function StayoverForm({ onDone }: { onDone: () => void }) {
  const { data: rooms } = useRooms({ status: 'OCCUPIED' });
  const { data: people } = useHousekeepers(true);
  const create = useCreateStayover();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [assignedToId, setAssignedToId] = useState(UNASSIGNED);
  const [isPriority, setIsPriority] = useState(false);
  const [notes, setNotes] = useState('');

  const submit = async () => {
    if (!roomId) return toast.error('Elige la habitación');
    try {
      await create.mutateAsync({
        roomId,
        assignedToId: assignedToId === UNASSIGNED ? null : assignedToId,
        isPriority,
        notes: notes.trim() || null,
      });
      toast.success('Repaso solicitado');
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="mb-2 grid size-10 place-items-center rounded-xl bg-violet-500/15 text-violet-600">
          <Sparkles className="size-5" />
        </div>
        <DialogTitle>Pedir repaso</DialogTitle>
        <DialogDescription>
          Limpieza con el huésped en casa (toallas, cama, basura…).
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Habitación ocupada</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string | null) => {
                  const room = rooms?.find((r) => r.id === v);
                  return room
                    ? `${room.number}${room.currentStay ? ` · ${room.currentStay.guest.firstName} ${room.currentStay.guest.lastName}` : ''}`
                    : 'Elige la habitación';
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {rooms?.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.number}
                  {r.currentStay &&
                    ` · ${r.currentStay.guest.firstName} ${r.currentStay.guest.lastName}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rooms?.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay habitaciones ocupadas.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Asignar a</Label>
          <Select
            value={assignedToId}
            onValueChange={(v) => setAssignedToId(v ?? UNASSIGNED)}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) =>
                  v === UNASSIGNED
                    ? 'Sin asignar (lista común)'
                    : people?.find((p) => p.id === v)?.name
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
              {people?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <span className="text-sm">
            <span className="font-medium">Prioridad</span>
            <span className="block text-xs text-muted-foreground">
              Aparece primero en la lista.
            </span>
          </span>
          <Switch checked={isPriority} onCheckedChange={setIsPriority} />
        </label>
        <div className="space-y-1.5">
          <Label htmlFor="stay-notes">Nota (opcional)</Label>
          <Textarea
            id="stay-notes"
            rows={2}
            maxLength={300}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Cambiar toallas"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          Pedir repaso
        </Button>
      </DialogFooter>
    </>
  );
}
