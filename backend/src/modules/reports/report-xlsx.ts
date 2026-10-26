import ExcelJS from 'exceljs';
import type { ColumnType, Report, ReportRow } from './report.types.js';

const BRAND = 'FF4F46E5';
const HEADER_FILL = 'FFEEF2FF';

const FORMATS: Partial<Record<ColumnType, string>> = {
  int: '#,##0',
  money: '"$"#,##0.00',
  usd: '"USD "#,##0.00',
  percent: '0.0"%"',
  date: 'dd/mm/yyyy',
  datetime: 'dd/mm/yyyy hh:mm',
};

/** Hora local del hotel como "fecha sin zona" para Excel. */
function localWall(iso: string, timeZone: string): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    ),
  );
}

function cellValue(
  value: string | number | null | undefined,
  type: ColumnType,
  timeZone: string,
): ExcelJS.CellValue {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'money':
    case 'usd':
      return Number(value) / 100;
    case 'date':
      return new Date(`${value}T00:00:00Z`);
    case 'datetime':
      return localWall(String(value), timeZone);
    default:
      return value;
  }
}

const fmtDate = (d: string) => d.split('-').reverse().join('/');

/** Encabezado común: hotel, título del reporte y rango. */
function header(
  ws: ExcelJS.Worksheet,
  report: Report,
  hotel: string,
  span: number,
) {
  ws.mergeCells(1, 1, 1, Math.max(span, 4));
  ws.getCell(1, 1).value = hotel;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: BRAND } };
  ws.mergeCells(2, 1, 2, Math.max(span, 4));
  ws.getCell(2, 1).value =
    `${report.title} · del ${fmtDate(report.from)} al ${fmtDate(report.to)}`;
  ws.getCell(2, 1).font = { bold: true, size: 12 };
}

function sheetName(title: string, used: Set<string>) {
  let name = title.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
  let i = 2;
  while (used.has(name)) name = `${name.slice(0, 28)} ${i++}`;
  used.add(name);
  return name;
}

/** Libro de Excel: hoja de resumen y una hoja por sección (con filtros). */
export async function reportToXlsx(
  report: Report,
  hotel: string,
  timeZone: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = hotel;
  wb.created = new Date();
  const used = new Set<string>();

  // Resumen
  const summary = wb.addWorksheet(sheetName('Resumen', used));
  header(summary, report, hotel, 2);
  summary.getRow(4).values = ['Indicador', 'Valor'];
  styleHeader(summary.getRow(4), 2);
  report.summary.forEach((item, i) => {
    const row = summary.getRow(5 + i);
    row.getCell(1).value = item.label;
    const cell = row.getCell(2);
    cell.value = cellValue(item.value, item.type, timeZone);
    if (FORMATS[item.type]) cell.numFmt = FORMATS[item.type]!;
  });
  if (report.notes) {
    const r = 6 + report.summary.length;
    summary.mergeCells(r, 1, r, 4);
    const cell = summary.getCell(r, 1);
    cell.value = report.notes;
    cell.font = { italic: true, color: { argb: 'FF6B7280' } };
    cell.alignment = { wrapText: true, vertical: 'top' };
    summary.getRow(r).height = 45;
  }
  summary.getColumn(1).width = 34;
  summary.getColumn(2).width = 20;

  for (const section of report.sections) {
    const ws = wb.addWorksheet(sheetName(section.title, used), {
      views: [{ state: 'frozen', ySplit: 4 }],
    });
    const cols = section.columns;
    header(ws, report, hotel, cols.length);
    const head = ws.getRow(4);
    head.values = cols.map((c) => c.label);
    styleHeader(head, cols.length);

    const write = (rowIndex: number, data: ReportRow) => {
      const row = ws.getRow(rowIndex);
      cols.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        cell.value = cellValue(data[c.key], c.type, timeZone);
        if (FORMATS[c.type]) cell.numFmt = FORMATS[c.type]!;
      });
      return row;
    };
    section.rows.forEach((data, i) => write(5 + i, data));
    if (section.rows.length) {
      ws.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4 + section.rows.length, column: cols.length },
      };
    }
    if (section.totals) {
      const row = write(5 + section.rows.length, {
        ...section.totals,
        [cols[0].key]: section.totals[cols[0].key] ?? 'Total',
      });
      row.font = { bold: true };
      row.eachCell((cell) => {
        cell.border = { top: { style: 'thin', color: { argb: BRAND } } };
      });
    }
    cols.forEach((c, i) => {
      const longest = Math.max(
        c.label.length,
        ...section.rows.map((r) => String(r[c.key] ?? '').length),
      );
      ws.getColumn(i + 1).width = Math.min(
        50,
        Math.max(c.type === 'datetime' ? 17 : 10, longest + 2),
      );
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function styleHeader(row: ExcelJS.Row, span: number) {
  row.font = { bold: true, color: { argb: BRAND } };
  for (let i = 1; i <= span; i++) {
    const cell = row.getCell(i);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    };
    cell.border = { bottom: { style: 'thin', color: { argb: BRAND } } };
  }
}
