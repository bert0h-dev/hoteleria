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

  return (
    <dl className="space-y-1.5 text-sm tabular-nums">
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
