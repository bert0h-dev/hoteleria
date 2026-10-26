import { useState } from 'react';
import { Loader2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCurrentShift } from '../cash-api';
import { OpenShiftForm } from './shift-dialogs';

/** Todo cobro exige turno abierto: si no hay, ofrece abrirlo ahí mismo. */
export function ShiftGate({
  onCancel,
  content,
}: {
  onCancel: () => void;
  content: React.ReactNode;
}) {
  const { data: shift, isLoading } = useCurrentShift();
  const [opening, setOpening] = useState(false);

  if (isLoading) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (shift) return content;
  if (opening) return <OpenShiftForm onDone={() => setOpening(false)} />;
  return (
    <>
      <DialogHeader>
        <div className="mb-2 grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-600">
          <Wallet className="size-5" />
        </div>
        <DialogTitle>Tu caja está cerrada</DialogTitle>
        <DialogDescription>
          Para cobrar o devolver dinero necesitas abrir tu turno de caja.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={() => setOpening(true)}>Abrir turno</Button>
      </DialogFooter>
    </>
  );
}
