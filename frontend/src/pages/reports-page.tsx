import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { FileSpreadsheet, Info, Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import {
  downloadReportXlsx,
  REPORTS,
  useReport,
  type ColumnType,
  type Report,
  type ReportKind,
} from '@/features/reports/reports-api';
import { getErrorMessage } from '@/lib/api';
import {
  addDays,
  formatCents,
  formatDayTime,
  formatUsdCents,
  todayInHotel,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const intFormat = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

function formatValue(
  value: string | number | null | undefined,
  type: ColumnType,
) {
  if (value === null || value === undefined || value === '') return '—';
  switch (type) {
    case 'money':
      return formatCents(Number(value));
    case 'usd':
      return formatUsdCents(Number(value));
    case 'percent':
      return `${intFormat.format(Number(value))} %`;
    case 'int':
      return intFormat.format(Number(value));
    case 'date':
      return String(value).split('-').reverse().join('/');
    case 'datetime':
      return formatDayTime(String(value));
    default:
      return String(value);
  }
}

const isNumeric = (t: ColumnType) =>
  t === 'int' || t === 'money' || t === 'usd' || t === 'percent';

/** Rangos rápidos a partir de hoy (zona del hotel). */
function presets(today: string) {
  const monthStart = `${today.slice(0, 8)}01`;
  const prevMonthEnd = addDays(monthStart, -1);
  return [
    { label: 'Hoy', from: today, to: today },
    { label: 'Ayer', from: addDays(today, -1), to: addDays(today, -1) },
    { label: '7 días', from: addDays(today, -6), to: today },
    { label: 'Este mes', from: monthStart, to: today },
    {
      label: 'Mes pasado',
      from: `${prevMonthEnd.slice(0, 8)}01`,
      to: prevMonthEnd,
    },
  ];
}

export function ReportsPage() {
  const { hasRole } = useAuth();
  const available = REPORTS.filter((r) => hasRole(...r.roles));
  const [params, setParams] = useSearchParams();
  const kindParam = params.get('tipo') as ReportKind | null;
  const kind =
    available.find((r) => r.kind === kindParam)?.kind ?? available[0]?.kind;
  const [today] = useState(() => todayInHotel());
  const [from, setFrom] = useState(() => `${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [downloading, setDownloading] = useState(false);
  const { data: report, isFetching, error } = useReport(kind!, from, to);

  if (!kind) return null;
  const meta = REPORTS.find((r) => r.kind === kind)!;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadReportXlsx(kind, from, to);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Reportes"
          description="Elige un reporte y el rango de fechas."
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => window.print()}
                disabled={!report}
              >
                <Printer />
                Imprimir
              </Button>
              <Button onClick={download} disabled={!report || downloading}>
                {downloading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileSpreadsheet />
                )}
                Excel
              </Button>
            </>
          }
        />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_1fr]">
        <nav className="space-y-1 print:hidden">
          {available.map(({ kind: k, label, description, icon: Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => setParams({ tipo: k })}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border border-transparent p-3 text-left transition-colors hover:bg-muted',
                k === kind && 'border-primary/30 bg-primary/5',
              )}
            >
              <Icon
                className={cn(
                  'mt-0.5 size-4 shrink-0 text-muted-foreground',
                  k === kind && 'text-primary',
                )}
              />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">
                  {description}
                </span>
              </span>
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-4">
          <Card className="gap-3 p-4 print:hidden">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from">Desde</Label>
                <Input
                  id="from"
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">Hasta</Label>
                <Input
                  id="to"
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presets(today).map((p) => (
                  <Button
                    key={p.label}
                    size="sm"
                    variant={
                      p.from === from && p.to === to ? 'default' : 'outline'
                    }
                    onClick={() => {
                      setFrom(p.from);
                      setTo(p.to);
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              {isFetching && (
                <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </Card>

          {error && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {getErrorMessage(error)}
            </p>
          )}
          {!report && !error && <Skeleton className="h-64 rounded-xl" />}
          {report && <ReportView report={report} icon={meta.icon} />}
        </div>
      </div>
    </div>
  );
}

function ReportView({
  report,
  icon: Icon,
}: {
  report: Report;
  icon: (typeof REPORTS)[number]['icon'];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary print:hidden">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{report.title}</h2>
          <p className="text-sm text-muted-foreground">
            Del {formatValue(report.from, 'date')} al{' '}
            {formatValue(report.to, 'date')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {report.summary.map((s) => (
          <Card key={s.label} className="gap-1 p-4">
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {formatValue(s.value, s.type)}
            </span>
          </Card>
        ))}
      </div>

      {report.notes && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {report.notes}
        </p>
      )}

      {report.sections.map((section) => (
        <Card key={section.title} className="gap-2 break-inside-avoid">
          <CardHeader>
            <CardTitle className="text-base">
              {section.title}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {section.rows.length} fila(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[32rem] overflow-auto print:max-h-none">
            {section.rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Sin datos en este rango.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    {section.columns.map((c) => (
                      <th
                        key={c.key}
                        className={cn(
                          'py-2 pr-3 font-medium whitespace-nowrap',
                          isNumeric(c.type) ? 'text-right' : 'text-left',
                        )}
                      >
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      {section.columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            'py-1.5 pr-3',
                            isNumeric(c.type) && 'text-right tabular-nums',
                          )}
                        >
                          {formatValue(row[c.key], c.type)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {section.totals && (
                  <tfoot>
                    <tr className="border-t-2 font-semibold">
                      {section.columns.map((c, i) => (
                        <td
                          key={c.key}
                          className={cn(
                            'py-2 pr-3',
                            isNumeric(c.type) && 'text-right tabular-nums',
                          )}
                        >
                          {i === 0
                            ? 'Total'
                            : section.totals![c.key] === undefined
                              ? ''
                              : formatValue(section.totals![c.key], c.type)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
