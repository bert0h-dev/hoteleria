import { formatMoneyCents } from '@/lib/format';
import { cn } from '@/lib/utils';
import { calculateTaxBreakdown, type TaxSettings } from './pricing';

/** Desglose de un precio con IVA e ISH incluidos. */
export function TaxBreakdown({
  total,
  taxes,
  className,
}: {
  total: number;
  taxes: TaxSettings;
  className?: string;
}) {
  const b = calculateTaxBreakdown(total, taxes);
  const rows = [
    { label: 'Subtotal', value: b.subtotal },
    { label: `IVA ${taxes.vatPercent} %`, value: b.vat },
    { label: `ISH ${taxes.lodgingTaxPercent} %`, value: b.lodgingTax },
  ];

  return (
    <dl className={cn('space-y-1 text-sm tabular-nums', className)}>
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex justify-between text-muted-foreground"
        >
          <dt>{r.label}</dt>
          <dd>{formatMoneyCents(r.value)}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t pt-1 font-semibold">
        <dt>Total (impuestos incluidos)</dt>
        <dd>{formatMoneyCents(b.total)}</dd>
      </div>
    </dl>
  );
}
