import { useState } from 'react';
import {
  Banknote,
  CreditCard,
  DollarSign,
  Landmark,
  Loader2,
  Wallet,
} from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { getErrorMessage } from '@/lib/api';
import { formatCents, formatUsdCents } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useAddCharge,
  useAddDiscount,
  useAddPayment,
  useConcepts,
  useRefund,
  useResolveStayCharge,
  useTodayRate,
  useVoid,
} from '../billing-api';
import { PAYMENT_METHODS, type Folio, type PaymentMethod } from '../types';
import { useAuthorizedAction } from '../use-authorized-action';

type Base = {
  folio: Folio;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function Shell({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        {open && children}
      </DialogContent>
    </Dialog>
  );
}

function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: typeof Wallet }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted',
            value === v &&
              'border-primary bg-primary/10 text-primary hover:bg-primary/15',
          )}
        >
          {Icon && <Icon className="size-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

const METHOD_ICONS: Record<PaymentMethod, typeof Wallet> = {
  CASH: Banknote,
  DEBIT_CARD: CreditCard,
  CREDIT_CARD: CreditCard,
  TRANSFER: Landmark,
  OTHER: Wallet,
};
const METHOD_OPTIONS = (Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map(
  (m) => ({
    value: m,
    label: PAYMENT_METHODS[m],
    icon: METHOD_ICONS[m],
  }),
);

const parseMoney = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

// ---------------------------------------------------------------------------
// Cobrar
// ---------------------------------------------------------------------------

export function PaymentDialog({ folio, open, onOpenChange }: Base) {
  return (
    <Shell open={open} onOpenChange={onOpenChange}>
      <PaymentForm folio={folio} onDone={() => onOpenChange(false)} />
    </Shell>
  );
}

function PaymentForm({ folio, onDone }: { folio: Folio; onDone: () => void }) {
  const pay = useAddPayment(folio.reservation.id);
  const { data: today } = useTodayRate();
  const balance = folio.totals.balanceCents;
  const [currency, setCurrency] = useState<'MXN' | 'USD'>('MXN');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState((balance / 100).toFixed(2));
  const [reference, setReference] = useState('');
  const rate = today?.rate ?? null;

  const value = parseMoney(amount);
  const mxnCents =
    value === null
      ? null
      : currency === 'USD' && rate
        ? Math.round(value * 100 * rate)
        : Math.round(value * 100);
  const needsReference = method !== 'CASH';

  const switchCurrency = (c: 'MXN' | 'USD') => {
    setCurrency(c);
    // Propone el saldo en la moneda elegida (en dólares, redondeado hacia arriba).
    setAmount(
      c === 'USD' && rate
        ? (Math.ceil(balance / rate) / 100).toFixed(2)
        : (balance / 100).toFixed(2),
    );
  };

  const submit = async () => {
    if (value === null) return toast.error('Escribe un monto válido');
    try {
      const updated = await pay.mutateAsync({
        method,
        currency,
        amount: value,
        reference: reference.trim() || null,
      });
      const receipt = updated.payments.at(-1);
      toast.success(`Pago registrado · recibo ${receipt?.receiptNumber}`, {
        description:
          updated.totals.balanceCents > 0
            ? `Saldo pendiente: ${formatCents(updated.totals.balanceCents)}`
            : 'La cuenta quedó pagada.',
      });
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Cobrar · {folio.reservation.code}</DialogTitle>
        <DialogDescription>
          Saldo pendiente{' '}
          <b className="text-foreground">{formatCents(balance)}</b>
          {folio.reservation.status === 'CONFIRMED' &&
            ' · se registrará como anticipo'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(['MXN', 'USD'] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={currency === c}
              disabled={c === 'USD' && !rate}
              onClick={() => switchCurrency(c)}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
                currency === c && 'bg-background text-foreground shadow-sm',
              )}
            >
              {c === 'MXN' ? (
                '$ Pesos'
              ) : (
                <>
                  <DollarSign className="size-4" /> Dólares
                </>
              )}
            </button>
          ))}
        </div>
        {!rate && (
          <p className="text-xs text-muted-foreground">
            Para recibir dólares captura primero el tipo de cambio de hoy (en el
            encabezado).
          </p>
        )}

        <div className="space-y-1.5">
          <Label>Método</Label>
          <Chips value={method} options={METHOD_OPTIONS} onChange={setMethod} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pay-amount">Monto ({currency})</Label>
          <Input
            id="pay-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-12 text-2xl font-semibold tabular-nums"
          />
          {currency === 'USD' && rate && mxnCents !== null && (
            <p className="text-sm text-muted-foreground">
              {formatUsdCents(Math.round((value ?? 0) * 100))} × {rate} ={' '}
              <b className="text-foreground">{formatCents(mxnCents)}</b>
            </p>
          )}
          {mxnCents !== null && mxnCents > balance && currency === 'MXN' && (
            <p className="text-sm text-destructive">El pago supera el saldo.</p>
          )}
        </div>

        {needsReference && (
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref">
              {method === 'TRANSFER'
                ? 'Referencia'
                : 'Últimos 4 dígitos o referencia'}
            </Label>
            <Input
              id="pay-ref"
              value={reference}
              maxLength={60}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pay.isPending || value === null}>
          {pay.isPending && <Loader2 className="animate-spin" />}
          Registrar pago
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cargo
// ---------------------------------------------------------------------------

const FREE = 'free';

export function ChargeDialog({ folio, open, onOpenChange }: Base) {
  return (
    <Shell open={open} onOpenChange={onOpenChange}>
      <ChargeForm folio={folio} onDone={() => onOpenChange(false)} />
    </Shell>
  );
}

function ChargeForm({ folio, onDone }: { folio: Folio; onDone: () => void }) {
  const add = useAddCharge(folio.reservation.id);
  const { data: concepts = [] } = useConcepts();
  const [conceptId, setConceptId] = useState(FREE);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState('');
  const concept = concepts.find((c) => c.id === conceptId);
  const items = [
    { value: FREE, label: 'Concepto libre' },
    ...concepts.map((c) => ({
      value: c.id,
      label: `${c.category ? `${c.category} · ` : ''}${c.name} · ${formatCents(c.priceCents)}`,
    })),
  ];
  const unit = parseMoney(price) ?? (concept ? concept.priceCents / 100 : null);
  const total =
    unit !== null && quantity > 0 ? Math.round(unit * 100) * quantity : null;

  const submit = async () => {
    if (!concept && !description.trim())
      return toast.error('Escribe la descripción');
    if (unit === null) return toast.error('Indica el precio');
    try {
      await add.mutateAsync({
        conceptId: concept?.id,
        description: description.trim() || undefined,
        quantity,
        unitPrice: parseMoney(price) ?? undefined,
      });
      toast.success('Cargo agregado');
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Agregar cargo</DialogTitle>
        <DialogDescription>
          Consumos y servicios; precios con impuestos incluidos.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ch-concept">Concepto</Label>
          <Select
            items={items}
            value={conceptId}
            onValueChange={(v) => v && setConceptId(v as string)}
          >
            <SelectTrigger id="ch-concept" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!concept && (
          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Descripción</Label>
            <Input
              id="ch-desc"
              value={description}
              maxLength={120}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. daño a toalla"
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ch-qty">Cantidad</Label>
            <Input
              id="ch-qty"
              type="number"
              min={1}
              max={999}
              value={quantity}
              onChange={(e) => setQuantity(e.target.valueAsNumber || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-price">Precio unitario</Label>
            <Input
              id="ch-price"
              inputMode="decimal"
              value={price}
              placeholder={
                concept ? (concept.priceCents / 100).toFixed(2) : '0.00'
              }
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        {total !== null && (
          <p className="text-right text-sm">
            Total <b className="text-lg">{formatCents(total)}</b>
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={add.isPending}>
          {add.isPending && <Loader2 className="animate-spin" />}
          Agregar cargo
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Descuento
// ---------------------------------------------------------------------------

export function DiscountDialog({ folio, open, onOpenChange }: Base) {
  return (
    <Shell open={open} onOpenChange={onOpenChange}>
      <DiscountForm folio={folio} onDone={() => onOpenChange(false)} />
    </Shell>
  );
}

function DiscountForm({ folio, onDone }: { folio: Folio; onDone: () => void }) {
  const add = useAddDiscount(folio.reservation.id);
  const { run, dialog } = useAuthorizedAction();
  const [mode, setMode] = useState<'amount' | 'percent'>('amount');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const { capCents, usedCents, percent } = folio.discountCap;
  const remaining = Math.max(capCents - usedCents, 0);
  const n = parseMoney(value);
  const cents =
    n === null
      ? null
      : mode === 'amount'
        ? Math.round(n * 100)
        : Math.round((folio.totals.grossCents * n) / 100);
  const overCap = cents !== null && cents > remaining;

  const submit = async () => {
    if (n === null) return toast.error('Escribe el descuento');
    if (!reason.trim()) return toast.error('Indica el motivo del descuento');
    try {
      const ok = await run((authorization) =>
        add.mutateAsync({
          ...(mode === 'amount' ? { amount: n } : { percent: n }),
          reason: reason.trim(),
          authorization,
        }),
      );
      if (ok) {
        toast.success('Descuento aplicado');
        onDone();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Aplicar descuento</DialogTitle>
        <DialogDescription>
          Tope sin autorización: {percent} % de la cuenta. Disponible{' '}
          <b className="text-foreground">{formatCents(remaining)}</b>.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Chips
          value={mode}
          options={[
            { value: 'amount', label: 'Monto ($)' },
            { value: 'percent', label: 'Porcentaje (%)' },
          ]}
          onChange={setMode}
        />
        <div className="space-y-1.5">
          <Label htmlFor="disc-value">
            {mode === 'amount' ? 'Monto' : 'Porcentaje de la cuenta'}
          </Label>
          <Input
            id="disc-value"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {cents !== null && (
            <p
              className={cn(
                'text-sm',
                overCap
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-muted-foreground',
              )}
            >
              Descuento de {formatCents(cents)}
              {overCap &&
                ' · rebasa el tope: se pedirá autorización (salvo que tengas descuentos sin límite)'}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="disc-reason">Motivo</Label>
          <Textarea
            id="disc-reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. cliente frecuente, queja por ruido…"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={add.isPending}>
          {add.isPending && <Loader2 className="animate-spin" />}
          Aplicar descuento
        </Button>
      </DialogFooter>
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------------------
// Condonar cargo sugerido
// ---------------------------------------------------------------------------

export function WaiveDialog({
  folio,
  charge,
  onOpenChange,
}: {
  folio: Folio;
  charge: Folio['stayCharges'][number] | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Shell open={!!charge} onOpenChange={onOpenChange}>
      {charge && (
        <WaiveForm
          folio={folio}
          charge={charge}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Shell>
  );
}

function WaiveForm({
  folio,
  charge,
  onDone,
}: {
  folio: Folio;
  charge: Folio['stayCharges'][number];
  onDone: () => void;
}) {
  const resolve = useResolveStayCharge(folio.reservation.id);
  const { run, dialog } = useAuthorizedAction();
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!reason.trim()) return toast.error('Indica el motivo para condonar');
    try {
      const ok = await run((authorization) =>
        resolve.mutateAsync({
          chargeId: charge.id,
          action: 'WAIVE',
          reason: reason.trim(),
          authorization,
        }),
      );
      if (ok) {
        toast.success('Cargo condonado');
        onDone();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Condonar cargo</DialogTitle>
        <DialogDescription>
          {charge.description} · {formatCents(charge.amount * 100)}. Cuenta para
          el tope de descuentos.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="waive-reason">Motivo</Label>
        <Textarea
          id="waive-reason"
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej. cortesía, solo fueron unos minutos…"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={resolve.isPending}>
          {resolve.isPending && <Loader2 className="animate-spin" />}
          Condonar
        </Button>
      </DialogFooter>
      {dialog}
    </>
  );
}

// ---------------------------------------------------------------------------
// Devolución
// ---------------------------------------------------------------------------

export function RefundDialog({ folio, open, onOpenChange }: Base) {
  return (
    <Shell open={open} onOpenChange={onOpenChange}>
      <RefundForm folio={folio} onDone={() => onOpenChange(false)} />
    </Shell>
  );
}

function RefundForm({ folio, onDone }: { folio: Folio; onDone: () => void }) {
  const refund = useRefund(folio.reservation.id);
  const credit = -folio.totals.balanceCents;
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState((credit / 100).toFixed(2));
  const [reason, setReason] = useState('');

  const submit = async () => {
    const n = parseMoney(amount);
    if (n === null) return toast.error('Escribe un monto válido');
    if (!reason.trim()) return toast.error('Indica el motivo de la devolución');
    try {
      await refund.mutateAsync({ method, amount: n, reason: reason.trim() });
      toast.success('Devolución registrada');
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Devolver saldo a favor</DialogTitle>
        <DialogDescription>
          Saldo a favor del huésped: {formatCents(credit)}.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <Chips value={method} options={METHOD_OPTIONS} onChange={setMethod} />
        <div className="space-y-1.5">
          <Label htmlFor="refund-amount">Monto</Label>
          <Input
            id="refund-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="refund-reason">Motivo</Label>
          <Textarea
            id="refund-reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={refund.isPending}>
          {refund.isPending && <Loader2 className="animate-spin" />}
          Registrar devolución
        </Button>
      </DialogFooter>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cancelar pago o movimiento (ADMIN)
// ---------------------------------------------------------------------------

export function VoidDialog({
  folio,
  target,
  onOpenChange,
}: {
  folio: Folio;
  target: { type: 'payment' | 'entry'; id: string; label: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const voidMutation = useVoid(folio.reservation.id);
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!target) return;
    if (!reason.trim())
      return toast.error('Indica el motivo de la cancelación');
    try {
      await voidMutation.mutateAsync({
        type: target.type,
        id: target.id,
        reason: reason.trim(),
      });
      toast.success(
        target.type === 'payment' ? 'Pago cancelado' : 'Movimiento cancelado',
      );
      setReason('');
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Shell open={!!target} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>
          Cancelar {target?.type === 'payment' ? 'pago' : 'movimiento'}
        </DialogTitle>
        <DialogDescription>
          {target?.label}. No se borra: queda marcado como cancelado con el
          motivo.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="void-reason">Motivo</Label>
        <Textarea
          id="void-reason"
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Volver
        </Button>
        <Button
          variant="destructive"
          onClick={submit}
          disabled={voidMutation.isPending}
        >
          {voidMutation.isPending && <Loader2 className="animate-spin" />}
          Cancelar
        </Button>
      </DialogFooter>
    </Shell>
  );
}
