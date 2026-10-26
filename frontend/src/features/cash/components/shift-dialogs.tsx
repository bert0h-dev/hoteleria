import { useState } from 'react';
import { Loader2, LockKeyhole, Wallet } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/api';
import { formatCents, formatUsdCents } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCloseShift, useOpenShift } from '../cash-api';
import type { CashShift } from '../types';

/** "1,250.50" → 1250.5; vacío → 0; inválido → null. */
function parseAmount(s: string): number | null {
  const clean = s.replace(/[$,\s]/g, '');
  if (!clean) return 0;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function MoneyInput({
  id,
  label,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoFocus={autoFocus}
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 text-lg font-semibold tabular-nums"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Abrir turno
// ---------------------------------------------------------------------------

export function OpenShiftDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open && <OpenShiftForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

export function OpenShiftForm({ onDone }: { onDone: () => void }) {
  const openShift = useOpenShift();
  const [mxn, setMxn] = useState('');
  const [usd, setUsd] = useState('');

  const submit = async () => {
    const openingMxn = parseAmount(mxn);
    const openingUsd = parseAmount(usd);
    if (openingMxn === null || openingUsd === null)
      return toast.error('Escribe montos válidos para el fondo');
    try {
      await openShift.mutateAsync({ openingMxn, openingUsd });
      toast.success('Turno de caja abierto');
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="mb-2 grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600">
          <Wallet className="size-5" />
        </div>
        <DialogTitle>Abrir turno de caja</DialogTitle>
        <DialogDescription>
          Cuenta el fondo con el que empiezas. Todos tus cobros quedarán en este
          turno hasta que hagas el corte.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput
          id="opening-mxn"
          label="Fondo en pesos"
          value={mxn}
          onChange={setMxn}
          autoFocus
        />
        <MoneyInput
          id="opening-usd"
          label="Fondo en dólares"
          value={usd}
          onChange={setUsd}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={openShift.isPending}>
          {openShift.isPending && <Loader2 className="animate-spin" />}
          Abrir turno
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Corte de caja
// ---------------------------------------------------------------------------

export function CloseShiftDialog({
  shift,
  onOpenChange,
  onClosed,
}: {
  shift: CashShift | null;
  onOpenChange: (open: boolean) => void;
  onClosed?: (id: string) => void;
}) {
  return (
    <Dialog open={!!shift} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {shift && (
          <CloseShiftForm
            shift={shift}
            onDone={(closed) => {
              onOpenChange(false);
              if (closed) onClosed?.(shift.id);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CloseShiftForm({
  shift,
  onDone,
}: {
  shift: CashShift;
  onDone: (closed: boolean) => void;
}) {
  const close = useCloseShift();
  const [mxn, setMxn] = useState('');
  const [usd, setUsd] = useState('');
  const [notes, setNotes] = useState('');
  const expectedMxn = shift.totals?.expectedMxnCents ?? 0;
  const expectedUsd = shift.totals?.expectedUsdCents ?? 0;

  const countedMxn = parseAmount(mxn);
  const countedUsd = parseAmount(usd);
  const diffMxn =
    countedMxn === null ? null : Math.round(countedMxn * 100) - expectedMxn;
  const diffUsd =
    countedUsd === null ? null : Math.round(countedUsd * 100) - expectedUsd;
  const short = (diffMxn ?? 0) < 0 || (diffUsd ?? 0) < 0;

  const submit = async () => {
    if (!mxn.trim()) return toast.error('Escribe el efectivo en pesos contado');
    if (countedMxn === null || countedUsd === null)
      return toast.error('Escribe montos válidos');
    if (short && !notes.trim())
      return toast.error('Falta efectivo: escribe un comentario');
    try {
      await close.mutateAsync({
        id: shift.id,
        countedMxn,
        countedUsd,
        notes: notes.trim() || null,
      });
      toast.success('Corte de caja registrado');
      onDone(true);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="mb-2 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <LockKeyhole className="size-5" />
        </div>
        <DialogTitle>Corte de caja · {shift.user.name}</DialogTitle>
        <DialogDescription>
          Cuenta el efectivo que hay en caja, incluido el fondo.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <MoneyInput
              id="counted-mxn"
              label="Pesos contados"
              value={mxn}
              onChange={setMxn}
              autoFocus
            />
            <Expected
              expected={formatCents(expectedMxn)}
              diff={diffMxn}
              format={formatCents}
              touched={!!mxn.trim()}
            />
          </div>
          <div className="space-y-2">
            <MoneyInput
              id="counted-usd"
              label="Dólares contados"
              value={usd}
              onChange={setUsd}
            />
            <Expected
              expected={formatUsdCents(expectedUsd)}
              diff={diffUsd}
              format={formatUsdCents}
              touched={!!usd.trim() || expectedUsd === 0}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="close-notes">
            Comentario {short ? '(obligatorio: falta efectivo)' : '(opcional)'}
          </Label>
          <Textarea
            id="close-notes"
            rows={2}
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            aria-invalid={short && !notes.trim()}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onDone(false)}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={close.isPending}>
          {close.isPending && <Loader2 className="animate-spin" />}
          Cerrar turno
        </Button>
      </DialogFooter>
    </>
  );
}

function Expected({
  expected,
  diff,
  format,
  touched,
}: {
  expected: string;
  diff: number | null;
  format: (cents: number) => string;
  touched: boolean;
}) {
  return (
    <div className="text-xs">
      <p className="text-muted-foreground">Esperado: {expected}</p>
      {touched && diff !== null && (
        <p
          className={cn(
            'font-medium',
            diff === 0 && 'text-emerald-600',
            diff < 0 && 'text-rose-600',
            diff > 0 && 'text-amber-600',
          )}
        >
          {diff === 0
            ? 'Cuadra exacto'
            : diff < 0
              ? `Faltan ${format(-diff)}`
              : `Sobran ${format(diff)}`}
        </p>
      )}
    </div>
  );
}
