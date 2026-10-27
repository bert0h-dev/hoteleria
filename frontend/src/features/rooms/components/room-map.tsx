import { useState } from 'react';
import { Eye, Sparkles, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/auth-context';
import { ReportProblemDialog } from '@/features/maintenance/report-problem-dialog';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { allowedTargets, ROOM_STATUS } from '../room-status';
import { useChangeRoomStatus } from '../rooms-api';
import type { Room } from '../types';

/** Vista compacta: un cuadro por habitación, con menú de acciones rápidas. */
export function RoomMap({
  rooms,
  onOpenDetails,
}: {
  rooms: Room[];
  onOpenDetails: (room: Room) => void;
}) {
  const [reporting, setReporting] = useState<Room | null>(null);

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2">
        {rooms.map((room) => (
          <RoomTile
            key={room.id}
            room={room}
            onOpenDetails={() => onOpenDetails(room)}
            onReport={() => setReporting(room)}
          />
        ))}
      </div>
      <ReportProblemDialog
        open={!!reporting}
        onOpenChange={(open) => !open && setReporting(null)}
        room={reporting ?? undefined}
      />
    </>
  );
}

function RoomTile({
  room,
  onOpenDetails,
  onReport,
}: {
  room: Room;
  onOpenDetails: () => void;
  onReport: () => void;
}) {
  const { user } = useAuth();
  const changeStatus = useChangeRoomStatus();
  const style = ROOM_STATUS[room.status];
  const housekeeper = user?.role === 'HOUSEKEEPING';
  const canFinishCleaning =
    room.isActive &&
    !!user &&
    room.status === 'CLEANING' &&
    allowedTargets(user.role, room.status).includes('AVAILABLE');
  const guest = room.currentStay?.guest;

  const finishCleaning = async () => {
    // Recepción y ADMIN eligen quién limpió en el detalle.
    if (!housekeeper) return onOpenDetails();
    try {
      await changeStatus.mutateAsync({ id: room.id, status: 'AVAILABLE' });
      toast.success(`Habitación ${room.number}: disponible`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Habitación ${room.number}, ${style.label}`}
        title={[
          room.roomType.name,
          style.label,
          guest && `${guest.firstName} ${guest.lastName}`,
        ]
          .filter(Boolean)
          .join(' · ')}
        className={cn(
          'relative grid aspect-square place-items-center rounded-lg text-sm font-bold text-white tabular-nums shadow-sm transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-popup-open:ring-2 data-popup-open:ring-ring data-popup-open:ring-offset-2',
          style.dot,
          room.blockOverdue && 'ring-2 ring-destructive ring-offset-2',
          !room.isActive && 'opacity-40',
        )}
      >
        {room.number}
        {guest?.isVip && (
          <span className="absolute top-0.5 right-1 text-[10px]">★</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block font-semibold text-foreground">
              {room.number} · {room.roomType.name}
            </span>
            <span className="block font-normal">
              {room.isActive ? style.label : 'Dada de baja'}
              {guest && ` · ${guest.firstName} ${guest.lastName}`}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenDetails}>
          <Eye />
          Ver detalle
        </DropdownMenuItem>
        {canFinishCleaning && (
          <DropdownMenuItem
            onClick={finishCleaning}
            disabled={changeStatus.isPending}
          >
            <Sparkles />
            {housekeeper ? 'Marcar limpia' : 'Marcar limpia…'}
          </DropdownMenuItem>
        )}
        {room.isActive && (
          <DropdownMenuItem onClick={onReport}>
            <Wrench />
            Reportar problema
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
