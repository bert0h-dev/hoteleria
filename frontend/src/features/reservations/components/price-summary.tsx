import type { NightPrice } from '@/features/hotel/pricing';
import { formatPercent } from '@/features/hotel/rate-periods-api';
import { formatMoney, formatMoneyCents } from '@/lib/format';
import { unitLabel, type Modality, type QuoteDetail } from '../types';

/** Desglose del precio de una estancia (cotización o reserva). */
export function PriceSummary({
  modality,
  baseAmount,
  extrasAmount,
  totalAmount,
  detail,
}: {
  modality: Modality;
  baseAmount: number;
  extrasAmount: number;
  totalAmount: number;
  detail: QuoteDetail;
}) {
  const baseLabel =
    modality === 'NIGHTLY' && detail.weeks
      ? `${detail.weeks} ${detail.weeks === 1 ? 'semana' : 'semanas'}${
          detail.extraNights
            ? ` + ${unitLabel('NIGHTLY', detail.extraNights)}`
            : ''
        }`
      : modality === 'HOURLY'
        ? detail.cappedAtDay
          ? `${unitLabel('HOURLY', detail.units)} (tope: precio del día)`
          : `${unitLabel('HOURLY', detail.billedHours ?? detail.units)}${
              (detail.billedHours ?? 0) > detail.units ? ' (mínimo)' : ''
            }`
        : unitLabel(modality, detail.units);

  const adjustedNights = detail.nights?.some((n) => n.source !== 'base')
    ? groupNights(detail.nights)
    : null;
  const rateDay =
    detail.rateDay && detail.rateDay.source !== 'base' ? detail.rateDay : null;

  return (
    <dl className="space-y-1.5 text-sm tabular-nums">
      {adjustedNights && (
        <div className="space-y-1 rounded-lg bg-muted/50 p-2 text-xs">
          {adjustedNights.map((g) => (
            <div key={g.key} className="flex justify-between gap-3">
              <span className="text-muted-foreground">
                {g.count} × {formatMoney(g.rate)} · {g.label}
              </span>
              <span>{formatMoney(g.count * g.rate)}</span>
            </div>
          ))}
          {detail.weeks ? (
            <p className="text-muted-foreground">
              Incluye precio de semana por bloques de 7 noches.
            </p>
          ) : null}
        </div>
      )}
      {rateDay && (
        <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
          Precio por noche del día de entrada: {formatMoney(rateDay.rate)} ·{' '}
          {nightLabel(rateDay)}
        </p>
      )}
      <Row label={`Hospedaje · ${baseLabel}`} value={formatMoney(baseAmount)} />
      {extrasAmount > 0 && (
        <Row
          label={`Personas extra · ${formatMoney(detail.extrasPerUnit)} × ${unitLabel(modality, detail.units)}`}
          value={formatMoney(extrasAmount)}
        />
      )}
      <div className="flex items-baseline justify-between border-t pt-2">
        <dt className="font-semibold">Total</dt>
        <dd className="text-xl font-bold">{formatMoney(totalAmount)}</dd>
      </div>
      <p className="text-right text-xs text-muted-foreground">
        Incluye IVA {formatMoneyCents(detail.taxes.vat)} e ISH{' '}
        {formatMoneyCents(detail.taxes.lodgingTax)}
      </p>
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-muted-foreground">
      <dt>{label}</dt>
      <dd className="shrink-0 text-foreground">{value}</dd>
    </div>
  );
}

function nightLabel(n: NightPrice) {
  return n.source === 'season'
    ? `${n.seasonName} ${formatPercent(n.adjustmentPercent)}`
    : n.source === 'weekday'
      ? `ajuste por día ${formatPercent(n.adjustmentPercent)}`
      : 'precio base';
}

/** Agrupa las noches con el mismo precio y la misma regla. */
function groupNights(nights: NightPrice[]) {
  const groups = new Map<
    string,
    { key: string; rate: number; label: string; count: number }
  >();
  for (const n of nights) {
    const label = nightLabel(n);
    const key = `${n.rate}|${label}`;
    const g = groups.get(key) ?? { key, rate: n.rate, label, count: 0 };
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()];
}
