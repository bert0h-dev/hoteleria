import { useState } from 'react';
import { Loader2, Wrench } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/auth-context';
import { useRooms } from '@/features/rooms/rooms-api';
import { getErrorMessage } from '@/lib/api';
import { addDays, todayInHotel } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  PRIORITIES,
  useCreateTicket,
  type TicketPriority,
} from './maintenance-api';

const AREA = 'area';

/**
 * Reportar un problema de mantenimiento. Con `room` la habitación queda
 * fija (p. ej. desde una tarea de limpieza).
 */
export function ReportProblemDialog({
  open,
  onOpenChange,
  room,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: { id: string; number: string };
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        {open && <ProblemForm room={room} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ProblemForm({
  room,
  onDone,
}: {
  room?: { id: string; number: string };
  onDone: () => void;
}) {
  const { hasRole } = useAuth();
  const canBlock = hasRole('ADMIN', 'RECEPTION');
  const { data: rooms } = useRooms({}, { enabled: !room });
  const create = useCreateTicket();
  const [today] = useState(() => todayInHotel());
  const [place, setPlace] = useState<string>(room?.id ?? '');
  const [area, setArea] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [blocksRoom, setBlocksRoom] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(() => addDays(today, 1));
  const isArea = place === AREA;
  const selected = room ?? rooms?.find((r) => r.id === place);
  const occupied =
    !room && rooms?.find((r) => r.id === place)?.status === 'OCCUPIED';

  const submit = async () => {
    if (!place) return toast.error('Elige la habitación o el área');
    if (isArea && !area.trim()) return toast.error('Escribe el área');
    if (!description.trim()) return toast.error('Describe el problema');
    try {
      await create.mutateAsync({
        roomId: isArea ? null : place,
        area: isArea ? area.trim() : null,
        description: description.trim(),
        priority,
        blocksRoom: !isArea && blocksRoom,
        blockedUntil: !isArea && blocksRoom ? blockedUntil : undefined,
      });
      toast.success('Problema reportado', {
        description:
          !isArea && blocksRoom
            ? `La habitación ${selected?.number} pasó a Mantenimiento`
            : undefined,
      });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="mb-2 grid size-10 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
          <Wrench className="size-5" />
        </div>
        <DialogTitle>
          Reportar problema{room ? ` · Hab. ${room.number}` : ''}
        </DialogTitle>
        <DialogDescription>
          Se crea un ticket de mantenimiento para recepción.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {!room && (
          <div className="space-y-1.5">
            <Label>Lugar</Label>
            <Select value={place} onValueChange={(v) => setPlace(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string) =>
                    v === AREA
                      ? 'Área general (lobby, pasillo…)'
                      : v
                        ? `Habitación ${rooms?.find((r) => r.id === v)?.number ?? ''}`
                        : 'Elige la habitación o el área'
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AREA}>Área general</SelectItem>
                {rooms?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    Habitación {r.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isArea && (
              <Input
                placeholder="Lobby, estacionamiento, pasillo 2…"
                maxLength={80}
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            )}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="problem">¿Qué pasa?</Label>
          <Textarea
            id="problem"
            rows={3}
            maxLength={500}
            autoFocus
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Fuga en el lavabo, foco fundido, A/C no enfría…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Prioridad</Label>
          <div className="flex gap-1.5">
            {(Object.keys(PRIORITIES) as TicketPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={priority === p}
                onClick={() => setPriority(p)}
                className={cn(
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
                  priority === p &&
                    cn('border-transparent', PRIORITIES[p].className),
                )}
              >
                {PRIORITIES[p].label}
              </button>
            ))}
          </div>
        </div>
        {canBlock && !isArea && place && (
          <div className="space-y-3 rounded-lg border p-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm">
                <span className="font-medium">Bloquear la habitación</span>
                <span className="block text-xs text-muted-foreground">
                  {occupied
                    ? 'Tiene huésped: no se puede bloquear ahora.'
                    : 'Pasa a Mantenimiento y no se renta hasta resolverlo.'}
                </span>
              </span>
              <Switch
                checked={blocksRoom}
                onCheckedChange={setBlocksRoom}
                disabled={occupied}
              />
            </label>
            {blocksRoom && (
              <div className="space-y-1.5">
                <Label htmlFor="until">Fecha estimada de fin</Label>
                <Input
                  id="until"
                  type="date"
                  min={today}
                  value={blockedUntil}
                  onChange={(e) => setBlockedUntil(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          Reportar
        </Button>
      </DialogFooter>
    </>
  );
}
