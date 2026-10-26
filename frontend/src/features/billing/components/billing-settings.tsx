import { useState } from 'react';
import {
  DollarSign,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Tags,
} from 'lucide-react';
import { toast } from 'sonner';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUpdateSettings, type Hotel } from '@/features/hotel/hotel-api';
import { getErrorMessage } from '@/lib/api';
import { formatCents, formatDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useConcepts, useRateHistory, useSaveConcept } from '../billing-api';
import type { ChargeConcept } from '../types';

export function BillingSettings({ hotel }: { hotel: Hotel }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-5">
      <div className="xl:col-span-3">
        <ConceptsCard />
      </div>
      <div className="space-y-6 xl:col-span-2">
        <RulesCard hotel={hotel} />
        <RatesCard />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RulesCard({ hotel }: { hotel: Hotel }) {
  const update = useUpdateSettings();
  const [cap, setCap] = useState(hotel.settings.discountCapPercent);
  const [series, setSeries] = useState(hotel.settings.receiptSeries);
  const dirty =
    cap !== hotel.settings.discountCapPercent ||
    series !== hotel.settings.receiptSeries;

  const save = async () => {
    try {
      await update.mutateAsync({
        discountCapPercent: cap,
        receiptSeries: series,
      });
      toast.success('Reglas de cobro guardadas');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptText className="size-4 text-primary" />
          Reglas de cobro
        </CardTitle>
        <CardDescription>
          Arriba del tope, el descuento necesita autorización con PIN (salvo
          usuarios con descuentos sin límite).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cap">Tope de descuento</Label>
          <div className="relative">
            <Input
              id="cap"
              type="number"
              min={0}
              max={100}
              value={Number.isFinite(cap) ? cap : ''}
              onChange={(e) => setCap(e.target.valueAsNumber)}
              className="pr-8"
            />
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="series">Serie de recibos</Label>
          <Input
            id="series"
            value={series}
            maxLength={5}
            onChange={(e) =>
              setSeries(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
            }
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">
            Siguiente: {series || '—'}-
            {String(hotel.settings.nextReceiptNumber).padStart(6, '0')}
          </p>
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t pt-6">
        <Button onClick={save} disabled={!dirty || update.isPending || !series}>
          {update.isPending && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
      </CardFooter>
    </Card>
  );
}

function RatesCard() {
  const { data } = useRateHistory();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="size-4 text-primary" />
          Tipos de cambio
        </CardTitle>
        <CardDescription>
          Se captura cada día desde el indicador «TC» del encabezado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data?.length ? (
          <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border text-sm">
            {data.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <span>{formatDay(r.date)}</span>
                <span className="text-xs text-muted-foreground">
                  {r.createdBy.name}
                </span>
                <span className="font-mono font-semibold">
                  ${r.rate.toFixed(4)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no se ha capturado ninguno.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ConceptsCard() {
  const { data: concepts = [] } = useConcepts(true);
  const save = useSaveConcept();
  const [editing, setEditing] = useState<ChargeConcept | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const toggle = async (c: ChargeConcept) => {
    try {
      await save.mutateAsync({ id: c.id, isActive: !c.isActive });
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  // Agrupa por categoría.
  const groups = new Map<string, ChargeConcept[]>();
  for (const c of concepts) {
    const key = c.category ?? 'Sin categoría';
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Tags className="size-4 text-primary" />
            Conceptos de cargo
          </CardTitle>
          <CardDescription>
            Consumos y servicios que recepción agrega a la cuenta (precios con
            impuestos incluidos).
          </CardDescription>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus />
          Nuevo
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {concepts.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aún no hay conceptos. Agrega por ejemplo «Agua embotellada» o
            «Lavandería».
          </p>
        )}
        {[...groups.entries()].map(([category, items]) => (
          <div key={category} className="space-y-1.5">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {category}
            </p>
            <div className="divide-y rounded-xl border">
              {items.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2',
                    !c.isActive && 'opacity-50',
                  )}
                >
                  <span className="flex-1 text-sm">{c.name}</span>
                  <span className="font-semibold tabular-nums">
                    {formatCents(c.priceCents)}
                  </span>
                  <Switch
                    checked={c.isActive}
                    onCheckedChange={() => toggle(c)}
                    aria-label="Activo"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${c.name}`}
                    onClick={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-sm">
          {formOpen && (
            <ConceptForm concept={editing} onDone={() => setFormOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ConceptForm({
  concept,
  onDone,
}: {
  concept: ChargeConcept | null;
  onDone: () => void;
}) {
  const save = useSaveConcept();
  const [name, setName] = useState(concept?.name ?? '');
  const [category, setCategory] = useState(concept?.category ?? '');
  const [price, setPrice] = useState(
    concept ? (concept.priceCents / 100).toFixed(2) : '',
  );

  const submit = async () => {
    const n = Number(price.replace(/[$,]/g, ''));
    if (!name.trim()) return toast.error('Escribe el nombre');
    if (!Number.isFinite(n) || n < 0)
      return toast.error('Escribe un precio válido');
    try {
      await save.mutateAsync({
        id: concept?.id,
        name: name.trim(),
        category: category.trim() || null,
        price: Math.round(n * 100) / 100,
      });
      toast.success(concept ? 'Concepto actualizado' : 'Concepto creado');
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {concept ? 'Editar concepto' : 'Nuevo concepto'}
        </DialogTitle>
        <DialogDescription>Precio con impuestos incluidos.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cc-name">Nombre</Label>
          <Input
            id="cc-name"
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cc-cat">Categoría</Label>
            <Input
              id="cc-cat"
              value={category}
              maxLength={40}
              placeholder="Minibar"
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-price">Precio</Label>
            <Input
              id="cc-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
      </DialogFooter>
    </>
  );
}
