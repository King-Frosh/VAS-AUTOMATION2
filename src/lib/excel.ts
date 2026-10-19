import * as XLSX from "xlsx";

/** The nine required MTN source headers in their original order. */
export const REQUIRED_HEADERS = [
  "DATE",
  "SERVICE ID",
  "PRICE POINT",
  "PRODUCT ID",
  "PRODUCT NAME",
  "TRANSACTION",
  "COUNT",
  "REVENUE",
] as const;

export const WORKSHEET_NAME = "Unreconciled Logs";

export interface ParsedRow {
  sourceRow: number;
  logDate: string; // canonical YYYY-MM-DD
  rawDate: string;
  servicePartner: string;
  serviceId: string;
  pricePoint: string;
  productId: string;
  productName: string;
  transaction: string;
  count: number;
  revenue: number;
  errors: string[];
}

export interface ParseResult {
  ok: boolean;
  errors: string[];
  rows: ParsedRow[];
  minDate: string;
  maxDate: string;
}

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Parse numeric Excel date serial to YYYY-MM-DD (UTC-based). */
function excelSerialToISO(serial: number): string {
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed) return "";
  const mm = String(parsed.m).padStart(2, "0");
  const dd = String(parsed.d).padStart(2, "0");
  return `${parsed.y}-${mm}-${dd}`;
}

/** Tolerantly parse a date value (Excel serial, Date, or common string formats) to YYYY-MM-DD. */
export function parseDateValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 80000) return excelSerialToISO(value);
    return "";
  }
  const s = String(value).trim();
  if (!s) return "";
  // If the string contains an ISO datetime like 2026-10-09T00:00:00.000Z
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (day-first, Nigerian convention)
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    let d = Number(dmy[1]);
    let m = Number(dmy[2]);
    const y = Number(dmy[3]);
    if (d > 12 && m <= 12) {
      // clearly day-first
    } else if (m > 12 && d <= 12) {
      [d, m] = [m, d]; // swap if clearly month-first written
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return "";
  }
  // 09-Oct-2026 style
  const named = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})$/);
  if (named) {
    const months: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };
    const m = months[named[2].slice(0, 3).toLowerCase()];
    if (m) return `${named[3]}-${String(m).padStart(2, "0")}-${String(Number(named[1])).padStart(2, "0")}`;
  }
  // Fallback to Date parsing (handles e.g. "October 9, 2026")
  const fallback = new Date(s);
  if (!Number.isNaN(fallback.getTime())) return fallback.toISOString().slice(0, 10);
  return "";
}

function parseNumberLoose(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[,₦$\s]/g, "");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Strip =, +, -, @ prefixes that could enable formula injection on export. */
function safeText(value: unknown): string {
  const s = String(value ?? "").trim();
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

export function parseSourceFile(buffer: Buffer, filename: string): ParseResult {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  let workbook: XLSX.WorkBook;
  try {
    // raw:true keeps CSV/TXT cells as original strings — preserves leading zeros
    // in SERVICE ID / PRODUCT ID and avoids locale-driven type coercion.
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, dense: true, raw: true });
  } catch {
    return { ok: false, errors: [`The file "${filename}" could not be parsed. Ensure it is a valid .xlsx, .xls or .csv file.`], rows: [], minDate: "", maxDate: "" };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) {
    return { ok: false, errors: ["The workbook does not contain any worksheet."], rows: [], minDate: "", maxDate: "" };
  }

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true, blankrows: false });
  if (aoa.length === 0) {
    return { ok: false, errors: ["The first worksheet is empty."], rows: [], minDate: "", maxDate: "" };
  }

  // Find the header row within the first 5 rows (tolerate title rows)
  let headerRowIdx = -1;
  let colMap: Record<string, number> = {};
  for (let r = 0; r < Math.min(5, aoa.length); r++) {
    const cells = (aoa[r] ?? []).map(normalizeHeader);
    const map: Record<string, number> = {};
    const dupes: string[] = [];
    cells.forEach((cell, idx) => {
      if (!cell) return;
      if ([...REQUIRED_HEADERS, "SERVICE PARTNER"].includes(cell)) {
        if (map[cell] !== undefined) dupes.push(cell);
        else map[cell] = idx;
      }
    });
    const found = REQUIRED_HEADERS.filter((h) => map[h] !== undefined);
    if (found.length >= 5) {
      headerRowIdx = r;
      colMap = map;
      if (dupes.length) errors.push(`Duplicated required columns: ${dupes.join(", ")}`);
      break;
    }
  }

  if (headerRowIdx === -1) {
    return {
      ok: false,
      errors: [
        "Could not locate the required MTN headers (DATE, SERVICE ID, PRICE POINT, PRODUCT ID, PRODUCT NAME, TRANSACTION, COUNT, REVENUE) in the first worksheet. SERVICE PARTNER is optional because matching uses SERVICE ID only.",
      ],
      rows: [],
      minDate: "",
      maxDate: "",
    };
  }

  const missing = REQUIRED_HEADERS.filter((h) => colMap[h] === undefined);
  if (missing.length) errors.push(`Missing required columns: ${missing.join(", ")}`);
  if (errors.length) return { ok: false, errors, rows: [], minDate: "", maxDate: "" };

  const get = (cells: unknown[], header: string): unknown =>
    colMap[header] === undefined ? "" : cells[colMap[header]];

  let minDate = "";
  let maxDate = "";
  for (let r = headerRowIdx + 1; r < aoa.length; r++) {
    const cells = aoa[r] ?? [];
    const isEmpty = cells.every((c) => c === "" || c === null || c === undefined);
    if (isEmpty) continue;

    const rowErrors: string[] = [];
    const rawDateVal = get(cells, "DATE");
    const logDate = parseDateValue(rawDateVal);
    if (!logDate) rowErrors.push(`Unparseable DATE value "${String(rawDateVal ?? "")}"`);

    const countVal = parseNumberLoose(get(cells, "COUNT"));
    if (countVal === null) rowErrors.push(`Non-numeric COUNT value "${String(get(cells, "COUNT") ?? "")}"`);
    const revenueVal = parseNumberLoose(get(cells, "REVENUE"));
    if (revenueVal === null) rowErrors.push(`Non-numeric REVENUE value "${String(get(cells, "REVENUE") ?? "")}"`);

    // SERVICE PARTNER is retained for display/audit only; it is not required
    // and does not participate in matching.
    const servicePartner = safeText(get(cells, "SERVICE PARTNER"));

    if (logDate) {
      if (!minDate || logDate < minDate) minDate = logDate;
      if (!maxDate || logDate > maxDate) maxDate = logDate;
    }

    rows.push({
      sourceRow: r + 1,
      logDate,
      rawDate: String(rawDateVal ?? "").trim(),
      servicePartner,
      serviceId: safeText(get(cells, "SERVICE ID")),
      pricePoint: safeText(get(cells, "PRICE POINT")),
      productId: safeText(get(cells, "PRODUCT ID")),
      productName: safeText(get(cells, "PRODUCT NAME")),
      transaction: safeText(get(cells, "TRANSACTION")),
      count: countVal === null ? 0 : Math.trunc(countVal),
      revenue: revenueVal ?? 0,
      errors: rowErrors,
    });
  }

  return { ok: true, errors, rows, minDate, maxDate };
}

export interface ReportRowInput {
  logDate: string;
  servicePartner: string;
  serviceId: string;
  pricePoint: string;
  productId: string;
  productName: string;
  transaction: string;
  count: number;
  revenue: number;
}

/** Generate the partner-service Excel workbook. Exactly one worksheet: "Unreconciled Logs". */
export function generateWorkbook(rows: ReportRowInput[]): Buffer {
  const headerRow = [...REQUIRED_HEADERS];
  const data: (string | number)[][] = [headerRow];
  for (const r of rows) {
    data.push([
      r.logDate,
      r.servicePartner,
      r.serviceId, // text preserved
      r.pricePoint,
      r.productId, // text preserved
      r.productName,
      r.transaction,
      r.count,
      Math.round(r.revenue * 10000) / 10000,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, WORKSHEET_NAME);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
}

/** Validate a generated workbook: valid xlsx, exactly one sheet named "Unreconciled Logs", nine headers. */
export function validateWorkbook(buffer: Buffer): { ok: boolean; error: string } {
  // xlsx is a zip package → magic bytes PK
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    return { ok: false, error: "File is not a valid .xlsx package." };
  }
  try {
    const wb = XLSX.read(buffer, { type: "buffer" });
    if (wb.SheetNames.length !== 1 || wb.SheetNames[0] !== WORKSHEET_NAME) {
      return { ok: false, error: `Workbook must contain exactly one worksheet named "${WORKSHEET_NAME}".` };
    }
    const sheet = wb.Sheets[WORKSHEET_NAME];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    const headerRow = (aoa[0] ?? []).map(normalizeHeader);
    const headersOk = REQUIRED_HEADERS.every((h, i) => headerRow[i] === h);
    if (!headersOk) return { ok: false, error: "Workbook headers do not match the nine required MTN headers in order." };
    return { ok: true, error: "" };
  } catch {
    return { ok: false, error: "Workbook could not be opened for validation." };
  }
}
