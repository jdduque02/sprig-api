import { join, sep } from 'node:path';
import { TransactionTypeEnum } from '@shared/enums';

// ============================================================
// Parser genérico de extractos bancarios (PDF)
// - Extrae texto con posiciones (x, y) mediante pdfjs-dist.
// - Detecta la cabecera de columnas (débito/crédito/saldo) y las
//   clasifica; si no hay cabecera, usa heurísticas por posición.
// - Soporta PDF con contraseña vía `password`.
// ============================================================

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

// `pdfjs-dist` >=4 se distribuye solo como ESM. Este proyecto compila a
// CommonJS, así que un `import()` normal sería reescrito por TypeScript a
// `require(...)`, que no puede cargar un módulo `.mjs`. `new Function` oculta
// el `import()` de esa transformación y fuerza el import dinámico real de
// Node en tiempo de ejecución.
// eslint-disable-next-line @typescript-eslint/no-implied-eval -- literal estático, no evalúa entrada externa; es el workaround estándar para invocar el import() nativo de Node desde código compilado a CommonJS.
const importPdfjs = new Function(
  'return import("pdfjs-dist/legacy/build/pdf.mjs")',
) as () => Promise<PdfjsModule>;

/** Envuelto en un objeto exportado para que los tests puedan mockearlo con `jest.spyOn`. */
export const pdfjsLoader = { load: importPdfjs };

const STANDARD_FONT_DATA_URL =
  join(require.resolve('pdfjs-dist/package.json'), '..', 'standard_fonts') +
  sep;

const MAX_TRANSACTIONS_PER_FILE = 5000;
const MAX_LINES_PER_FILE = 20000;

interface TextToken {
  x: number;
  y: number;
  text: string;
  /** Coordenada absoluta horizontal (sin normalizar). */
  absX?: number;
  /** Número de página de la que proviene el token. */
  page?: number;
}

export interface TextLine {
  y: number;
  tokens: TextToken[];
  page?: number;
}

export interface ParsedStatementTransaction {
  transaction_date: string; // YYYY-MM-DD
  description: string;
  amount: number; // siempre positivo
  type: TransactionTypeEnum.INCOME | TransactionTypeEnum.EXPENSE;
  balance?: number;
  reference?: string;
  /** Número de cuotas de la compra cuando la tarjeta lo reporta. */
  installments?: number;
  /** Valor de cada cuota / abono cuando el extracto lo reporta. */
  installment_value?: number;
}

export interface StatementParseResult {
  transactions: ParsedStatementTransaction[];
  bank?: string;
  period?: string;
}

/**
 * Configuración de detección de una entidad bancaria. Los patrones son
 * expresiones regulares (sin flags) que se evalúan contra cada línea del
 * extracto; la entidad que más líneas coincida gana.
 */
export interface BankingEntityDetection {
  code: string;
  detect_patterns: string[];
}

const MONTH_MAP: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  set: 9,
  oct: 10,
  nov: 11,
  dic: 12,
  jan: 1,
  apr: 4,
  aug: 8,
  dec: 12,
};

// ── Extracción de texto con posiciones ───────────────────────

export async function extractTextLines(
  buffer: Buffer,
  password?: string,
): Promise<TextLine[]> {
  const pdfjs = await pdfjsLoader.load();

  let doc: Awaited<ReturnType<PdfjsModule['getDocument']>['promise']>;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    });
    doc = await loadingTask.promise;
  } catch (err) {
    const e = err as Error;
    const name = e?.name ?? '';
    const msg = String(e?.message ?? err);
    if (name === 'PasswordException' || /password|clave|encrypt/i.test(msg)) {
      throw err;
    }
    throw new Error(`PDF_READ_ERROR: ${name}: ${msg}`);
  }

  const tokens: TextToken[] = [];
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      for (const item of content.items) {
        const str = item.str ?? '';
        if (!str.trim()) continue;
        const y = Math.round((item.transform?.[5] ?? 0) * 10) / 10;
        const x = item.transform?.[4] ?? 0;
        tokens.push({ x, y, text: str, absX: x, page: pageNum });
        if (tokens.length > MAX_LINES_PER_FILE * 8) break;
      }
      if (tokens.length > MAX_LINES_PER_FILE * 8) break;
    }
  } finally {
    void doc.destroy?.();
  }

  let maxX = 1;
  for (const token of tokens) {
    if (token.x > maxX) maxX = token.x;
  }

  const lines: TextLine[] = [];
  for (const token of tokens) {
    const xr = Math.min(token.x / maxX, 1);
    const line = lines.find(
      (l) => l.page === token.page && Math.abs(l.y - token.y) <= 1.5,
    );
    if (line) {
      line.tokens.push({
        x: xr,
        y: token.y,
        text: token.text,
        absX: token.absX,
        page: token.page,
      });
    } else {
      lines.push({
        y: token.y,
        page: token.page,
        tokens: [
          {
            x: xr,
            y: token.y,
            text: token.text,
            absX: token.absX,
            page: token.page,
          },
        ],
      });
    }
  }

  for (const line of lines) {
    line.tokens.sort((a, b) => a.x - b.x);
  }
  lines.sort((a, b) => b.y - a.y);

  return lines.slice(0, MAX_LINES_PER_FILE);
}

// ── Utilidades numéricas y de fecha ─────────────────────────

/** Convierte un token numérico (formato CO o US) a número. */
export function parseAmount(raw: string): number | null {
  let s = String(raw)
    .replace(/\s+/g, '')
    .replace(/[$€£]/g, '')
    .replace(/\b(COP|USD|EUR)\b/gi, '');

  if (!s) return null;
  if (/^[^0-9+\-()]+$/.test(s)) return null;

  let negative = false;
  const paren = s.match(/^\((.*)\)$/);
  if (paren) {
    negative = true;
    s = paren[1];
  }
  if (/^[-−–]/.test(s)) {
    negative = true;
    s = s.slice(1);
  }
  if (/[-−–]$/.test(s)) {
    negative = true;
    s = s.slice(0, -1);
  }
  s = s.replace(/^[+]/, '').replace(/^(CR|DB|C|D)$/i, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  let intPart = s;
  let decPart = '';

  const hasBoth = lastComma !== -1 && lastDot !== -1;
  if (hasBoth) {
    if (lastComma > lastDot) {
      decPart = s.slice(lastComma + 1);
      intPart = s.slice(0, lastComma).replace(/[.,]/g, '');
    } else {
      decPart = s.slice(lastDot + 1);
      intPart = s.slice(0, lastDot).replace(/[.,]/g, '');
    }
  } else if (lastComma !== -1) {
    const after = s.slice(lastComma + 1);
    const before = s.slice(0, lastComma);
    if (after.length === 3 && (before.includes('.') || before.length > 3)) {
      intPart = s.replace(/,/g, '');
    } else {
      decPart = after;
      intPart = before.replace(/,/g, '');
    }
  } else if (lastDot !== -1) {
    const after = s.slice(lastDot + 1);
    const before = s.slice(0, lastDot);
    if (after.length === 3 && (before.includes(',') || before.length > 3)) {
      intPart = s.replace(/\./g, '');
    } else {
      decPart = after;
      intPart = before.replace(/\./g, '');
    }
  }

  if (decPart.length > 2) decPart = decPart.slice(0, 2);
  if (!/^\d+$/.test(intPart)) return null;

  const value = Number(intPart) + (decPart ? Number(`0.${decPart}`) : 0);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function twoDigitYear(yy: number): number {
  return yy < 70 ? 2000 + yy : 1900 + yy;
}

/** Detecta una fecha al inicio de un token. Devuelve fecha + resto del token. */
export function parseDateFromToken(
  raw: string,
): { date: string; rest?: string } | null {
  const token = String(raw).trim();
  if (!token) return null;

  const iso = token.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/);
  if (iso) {
    const [, y, m, d, rest] = iso;
    const date = buildDate(Number(y), Number(m), Number(d));
    if (date) return { date, rest: cleanRest(rest) };
  }

  const dmy = token.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(.*)$/);
  if (dmy) {
    const [, d, m, y, rest] = dmy;
    const date = buildDate(
      y.length === 4 ? Number(y) : twoDigitYear(Number(y)),
      Number(m),
      Number(d),
    );
    if (date) return { date, rest: cleanRest(rest) };
  }

  const letters = token.match(
    /^(\d{1,2})[-/.]?\s*([a-záéíóúñ]{3,9})[-/.]?\s*(\d{2,4})(.*)$/i,
  );
  if (letters) {
    const [, d, mon, y, rest] = letters;
    const month = MONTH_MAP[mon.toLowerCase().slice(0, 3)];
    if (month) {
      const date = buildDate(
        y.length === 4 ? Number(y) : twoDigitYear(Number(y)),
        month,
        Number(d),
      );
      if (date) return { date, rest: cleanRest(rest) };
    }
  }

  return null;
}

function cleanRest(rest: string | undefined): string | undefined {
  const r = (rest ?? '').trim();
  return r || undefined;
}

function buildDate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) return null;
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// ── Detección de columnas por cabecera ──────────────────────

interface ColumnLayout {
  debitX?: number;
  creditX?: number;
  balanceX?: number;
}

const HEADER_DATE = /fecha/i;
const HEADER_DEBIT = /d[eé]bito|cargo|retiros?|debito/i;
const HEADER_CREDIT = /cr[eé]dito|abonos?|ingresos?|credito/i;
const HEADER_BALANCE = /saldo|disponible|balance/i;
const HEADER_NOISE =
  /saldo inicial|saldo anterior|saldo final|saldo actual|saldo en|resumen|total (d[eé]bitos|cr[eé]ditos|movimientos)|movimientos d[eé]bitos|movimientos cr[eé]ditos/i;
const EXPENSE_KEYWORDS =
  /(compra|pago|p[oó]liza|pse|d[eé]bito|cargo|retiro|consumo|cuota|trasferencia enviada|transferencia enviada|giro|comisi[oó]n|impuesto|interes por|servicio|nomina (del|de )?pagada|nota d[eé]bito|d[eé]bito autom[aá]tico|abono a tarjeta|pago tarjeta|pago de (tarjeta|obligaci[oó]n)|cesant[ií]as|arriendo|matr[ií]cula|seguro)/i;
const INCOME_KEYWORDS =
  /(abono|cr[eé]dito|consignaci[oó]n|nomina|n[oó]mina|ingreso|sueldo|salario|transferencia recibida|trasferencia recibida|renta|intereses|nota cr[eé]dito|devoluci[oó]n|reintegro|d[eé]posito|dep[oó]sito|pago de n[oó]mina|aporte|recaudo|compensaci[oó]n|certificado de dep[oó]sito)/i;

function detectColumnLayout(lines: TextLine[]): ColumnLayout {
  const layout: ColumnLayout = {};
  for (const line of lines) {
    for (const token of line.tokens) {
      const t = token.text.trim();
      if (HEADER_DATE.test(t)) continue;
      if (HEADER_BALANCE.test(t) && layout.balanceX === undefined) {
        layout.balanceX = token.x;
      }
      if (HEADER_CREDIT.test(t) && layout.creditX === undefined) {
        layout.creditX = token.x;
      }
      if (HEADER_DEBIT.test(t) && layout.debitX === undefined) {
        layout.debitX = token.x;
      }
    }
  }
  return layout;
}

// ── Clasificación de un movimiento ──────────────────────────

interface Movement {
  amount: number;
  type: TransactionTypeEnum.INCOME | TransactionTypeEnum.EXPENSE;
  balance?: number;
}

function classifyMovement(
  numericTokens: { x: number; value: number; raw: string }[],
  layout: ColumnLayout,
  description: string,
  defaultType?: TransactionTypeEnum,
): Movement | null {
  if (numericTokens.length === 0) return null;

  const last = numericTokens[numericTokens.length - 1];
  const lastRaw = last.raw.toUpperCase();
  const hasCrFlag = /\bCR\b/.test(lastRaw) || /^C$/i.test(lastRaw.trim());
  const hasDbFlag = /\bDB\b/.test(lastRaw) || /^D$/i.test(lastRaw.trim());

  // Si hay cabeceras, asigna cada monto a la columna más cercana (sin repetir).
  if (layout.debitX !== undefined || layout.creditX !== undefined) {
    const candidates = [...numericTokens];
    const pick = (colX: number | undefined): TextTokenOfMov | undefined => {
      if (colX === undefined || candidates.length === 0) return undefined;
      let best: TextTokenOfMov | undefined;
      let bestDist = Infinity;
      for (const t of candidates) {
        const d = Math.abs(t.x - colX);
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      if (best) candidates.splice(candidates.indexOf(best), 1);
      return best;
    };

    const debitTok = pick(layout.debitX);
    const creditTok = pick(layout.creditX);
    const balanceTok = pick(layout.balanceX);

    const debitVal = debitTok ? Math.abs(debitTok.value) : 0;
    const creditVal = creditTok ? Math.abs(creditTok.value) : 0;

    if (debitVal > 0 || creditVal > 0) {
      let amount: number;
      let type: TransactionTypeEnum.INCOME | TransactionTypeEnum.EXPENSE;
      if (debitVal > 0 && creditVal > 0) {
        amount = debitVal;
        type =
          defaultType === TransactionTypeEnum.INCOME
            ? TransactionTypeEnum.INCOME
            : TransactionTypeEnum.EXPENSE;
      } else if (debitVal > 0) {
        amount = debitVal;
        type = TransactionTypeEnum.EXPENSE;
      } else {
        amount = creditVal;
        type = TransactionTypeEnum.INCOME;
      }
      return {
        amount,
        type,
        balance: balanceTok ? Math.abs(balanceTok.value) : undefined,
      };
    }
  }

  // Sin cabeceras limpias: heurística.
  if (numericTokens.length >= 3) {
    // [débito, crédito, saldo] ordenados de izquierda a derecha.
    const [a, b, c] = numericTokens;
    const debit = Math.abs(a.value);
    const credit = Math.abs(b.value);
    const balance = Math.abs(c.value);
    if (debit > 0 || credit > 0) {
      return {
        amount: debit > 0 ? debit : credit,
        type:
          debit > 0 && credit > 0
            ? defaultType === TransactionTypeEnum.INCOME
              ? TransactionTypeEnum.INCOME
              : TransactionTypeEnum.EXPENSE
            : debit > 0
              ? TransactionTypeEnum.EXPENSE
              : TransactionTypeEnum.INCOME,
        balance,
      };
    }
  }

  const movement = last;
  const value = movement.value;

  if (value === 0) return null;

  // Señales explícitas del token.
  if (value < 0 || hasDbFlag) {
    return { amount: Math.abs(value), type: TransactionTypeEnum.EXPENSE };
  }
  if (hasCrFlag) {
    return { amount: Math.abs(value), type: TransactionTypeEnum.INCOME };
  }

  // Señales del texto.
  if (EXPENSE_KEYWORDS.test(description)) {
    return { amount: Math.abs(value), type: TransactionTypeEnum.EXPENSE };
  }
  if (INCOME_KEYWORDS.test(description)) {
    return { amount: Math.abs(value), type: TransactionTypeEnum.INCOME };
  }

  return {
    amount: Math.abs(value),
    type:
      defaultType === TransactionTypeEnum.INCOME
        ? TransactionTypeEnum.INCOME
        : TransactionTypeEnum.EXPENSE,
  };
}

type TextTokenOfMov = { x: number; value: number; raw: string };

function isNumericToken(tok: { x: number; text: string }): boolean {
  return /^[+\-−–]?\s*[\d.,]+\s*(CR|DB|C|D)?$/i.test(tok.text.trim());
}

/**
 * Intenta extraer el número de cuotas y el valor de la cuota/abono de una
 * fila de extracto de tarjeta de crédito, usando los tokens numéricos que
 * aparecen a la derecha de la columna "valor". Heurísticas:
 *   - cuotas: primer entero pequeño (1-999) que aparezca solo en la zona de
 *     cuotas (a la derecha del valor).
 *   - valor cuota/abono: si hay más de una cuota y la fila no es un abono,
 *     se estima como monto / cuotas; si hay un monto explícito de la columna
 *     "valor cuota/abono" se usa ese.
 */
function extractInstallments(
  line: TextLine,
  afterAbsX: number,
  amount: number,
  isIncome: boolean,
): { installments?: number; installment_value?: number } {
  const tokens = line.tokens
    .filter((t) => t.absX !== undefined && t.absX > afterAbsX + 2)
    .map((t) => ({ x: t.absX as number, text: t.text.trim() }));

  // Número de cuotas: un entero puro pequeño (1-999) en la columna "cuotas".
  const cuotasToken = tokens.find(
    (t) => /^\d{1,3}$/.test(t.text) && Number(t.text) >= 1,
  );
  if (!cuotasToken) return {};
  const installments = Number(cuotasToken.text);
  if (installments <= 1) return { installments: 1 };

  // Valor cuota/abono: monto con decimales que esté cerca del número de
  // cuotas (siguiente columna) y que no sea un porcentaje ni el saldo.
  const cuotasIdx = tokens.indexOf(cuotasToken);
  const next = tokens.slice(cuotasIdx + 1, cuotasIdx + 3).find((t) => {
    if (/^\d{1,3}$/.test(t.text)) return false;
    const v = parseAmount(t.text);
    if (v === null || v === 0) return false;
    // Filtra columnas de % de interés (valores < 60 sin sentido como cuota).
    if (Math.abs(v) < 1 && /%/.test(t.text)) return false;
    return Math.abs(v) <= amount * 1.5;
  });

  if (next) {
    const v = parseAmount(next.text);
    if (v !== null && v > 0) return { installments, installment_value: v };
  }

  // Estimación conservadora: valor por cuota = monto / cuotas.
  if (!isIncome) {
    return { installments, installment_value: amount / installments };
  }
  return { installments };
}

function extractReference(description: string): string | undefined {
  const m = description.match(
    /(?:^|\s)(#\S+|\b(?:REF|REFERENCIA|NRO|NUM|OPERACION|OP)\b\s*[:.-]?\s*[A-Za-z0-9_.-]+)/i,
  );
  if (!m) return undefined;
  return m[1].replace(/\s+/g, ' ').trim().slice(0, 100);
}

function normalizeDescription(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 300);
}

// ── Parsers específicos por banco ───────────────────────────

/**
 * Patrones de detección de las entidades construidas. Se usan como respaldo
 * cuando no se pasan entidades configuradas (p. ej. en pruebas unitarias).
 * Las entidades gestionadas por el módulo de soporte deben sembrar estos
 * mismos patrones para que el reconocimiento siga funcionando en producción.
 */
const BUILTIN_DETECT_PATTERNS: BankingEntityDetection[] = [
  {
    code: 'bancolombia',
    detect_patterns: [
      'Nuevos movimientos entre',
      'Couta/Abono',
      'N[uú]mero de autorizaci[oó]n',
      'Movimientos antes de',
    ],
  },
  {
    code: 'rappicard',
    detect_patterns: [
      'Detalle de transacciones',
      'Tasa M\\.V',
      'PAGOS POR PSE',
      'Extracto de tarjeta de cr[eé]dito',
    ],
  },
  {
    code: 'nu',
    detect_patterns: [
      'Nu Placa',
      'N[uú]mero de Cuenta',
      'Lleg[oó] tu extracto',
      'Resumen de tus movimientos',
      'Dinero Disponible',
    ],
  },
];

function detectBank(
  lines: TextLine[],
  entities?: BankingEntityDetection[],
): string | undefined {
  const candidates =
    entities && entities.length > 0 ? entities : BUILTIN_DETECT_PATTERNS;

  let best: { code: string; score: number } | undefined;
  for (const entity of candidates) {
    let score = 0;
    for (const line of lines) {
      const joined = line.tokens.map((t) => t.text).join(' ');
      for (const pattern of entity.detect_patterns) {
        try {
          if (new RegExp(pattern, 'i').test(joined)) score++;
        } catch {
          // Patrón inválido configurado por el administrador: se ignora.
        }
      }
    }
    if (!best || score > best.score) {
      best = { code: entity.code, score };
    }
  }

  if (!best || best.score === 0) return undefined;
  return best.code;
}

const BALANCE_REF_REGEX = /^[A-Z0-9]+$/;

// Bancolombia (tarjeta de crédito): secciones con cabecera
// "Nuevos movimientos entre ..." / "Movimientos antes de ...".
// Filas: [autorización, fecha dd/mm/aaaa, descripción, valor, cuotas,
// valor couta/abono, % interés mes, % interés año, saldo pendiente].
// El valor negativo indica abono/pago (ingreso); positivo, consumo (gasto).
function parseBancolombia(lines: TextLine[]): StatementParseResult {
  const transactions: ParsedStatementTransaction[] = [];
  let period: string | undefined;

  for (const line of lines) {
    const joined = line.tokens.map((t) => t.text).join(' ');
    if (!period) {
      const m = joined.match(
        /Nuevos movimientos entre\s+(\d{1,2})\s+([a-záéíóúñ]{3,9})\s+hasta\s+(\d{1,2})\s+([a-záéíóúñ]{3,9})[.]?\s+(\d{4})/i,
      );
      if (m) period = `${m[1]} ${m[2]} - ${m[3]} ${m[4]} ${m[5]}`;
    }

    const dateTok = line.tokens.find(
      (t) =>
        t.absX !== undefined &&
        t.absX >= 70 &&
        t.absX <= 100 &&
        /^\d{2}\/\d{2}\/\d{4}$/.test(t.text.trim()),
    );
    if (!dateTok) continue;
    const parsedDate = parseDateFromToken(dateTok.text);
    if (!parsedDate) continue;

    const amountTok = line.tokens.find(
      (t) =>
        t.absX !== undefined &&
        t.absX >= 250 &&
        t.absX <= 295 &&
        parseAmount(t.text) !== null,
    );
    if (!amountTok) continue;
    const value = parseAmount(amountTok.text);
    if (value === null || value === 0) continue;
    const isIncome = value < 0;

    const authTok = line.tokens.find(
      (t) =>
        t.absX !== undefined &&
        t.absX < 60 &&
        BALANCE_REF_REGEX.test(t.text.trim()),
    );
    const description = normalizeDescription(
      line.tokens
        .filter((t) => t.absX !== undefined && t.absX >= 130 && t.absX <= 250)
        .map((t) => t.text)
        .join(' '),
    );

    // Omitir pagos de tarjeta (abonos desde sucursal virtual)
    if (description && /ABONO SUCURSAL VIRTUAL/i.test(description)) continue;

    const tx: ParsedStatementTransaction = {
      transaction_date: parsedDate.date,
      description: description || 'Movimiento bancario',
      amount: Math.abs(value),
      type: isIncome ? TransactionTypeEnum.INCOME : TransactionTypeEnum.EXPENSE,
    };
    if (authTok) tx.reference = authTok.text.trim();

    const installments = extractInstallments(
      line,
      amountTok.absX as number,
      Math.abs(value),
      isIncome,
    );
    if (installments.installments !== undefined)
      tx.installments = installments.installments;
    if (installments.installment_value !== undefined)
      tx.installment_value = installments.installment_value;

    transactions.push(tx);
  }

  return {
    transactions: transactions.slice(0, MAX_TRANSACTIONS_PER_FILE),
    bank: 'bancolombia',
    period,
  };
}

// RappiCard (Davivienda): tabla con columnas Tarjeta/Fecha/Descripción/
// Valor transacción/Capital facturado/Cuotas/Capital por facturar/Tasas.
// La fecha es ISO (YYYY-MM-DD). El valor es negativo para pagos (PSE).
// Las descripciones pueden continuar en líneas posteriores de la misma página.
function parseRappiCard(lines: TextLine[]): StatementParseResult {
  let period: string | undefined;
  let desde: string | undefined;
  let hasta: string | undefined;
  for (const line of lines) {
    const isDesde = line.tokens.some((t) => /^Desde$/.test(t.text.trim()));
    const isHasta = line.tokens.some((t) => /^Hasta$/.test(t.text.trim()));
    if (!isDesde && !isHasta) continue;
    const dateTok = line.tokens.find((t) =>
      /^\d{1,2}\s+[a-záéíóúñ]{3,9}\s+\d{4}$/i.test(t.text.trim()),
    );
    if (!dateTok) continue;
    if (isDesde) desde = dateTok.text.trim();
    else hasta = dateTok.text.trim();
  }
  if (desde && hasta) period = `${desde} - ${hasta}`;

  const transactions: ParsedStatementTransaction[] = [];
  let current: {
    date: string;
    y: number;
    page: number;
    desc: string[];
    amount: number;
    installments?: number;
    installment_value?: number;
  } | null = null;

  const finalize = () => {
    if (!current) return;
    if (current.amount !== 0) {
      const tx: ParsedStatementTransaction = {
        transaction_date: current.date,
        description:
          normalizeDescription(current.desc.join(' ')) || 'Movimiento bancario',
        amount: Math.abs(current.amount),
        type:
          current.amount < 0
            ? TransactionTypeEnum.INCOME
            : TransactionTypeEnum.EXPENSE,
      };
      if (current.installments !== undefined)
        tx.installments = current.installments;
      if (current.installment_value !== undefined)
        tx.installment_value = current.installment_value;
      transactions.push(tx);
    }
    current = null;
  };

  for (const line of lines) {
    const dateTok = line.tokens.find(
      (t) =>
        t.absX !== undefined &&
        t.absX >= 75 &&
        t.absX <= 100 &&
        /^\d{4}-\d{2}-\d{2}$/.test(t.text.trim()),
    );

    if (dateTok) {
      finalize();
      const amountTok = line.tokens.find(
        (t) => t.absX !== undefined && t.absX >= 225 && t.absX <= 250,
      );
      const amount = amountTok ? (parseAmount(amountTok.text) ?? 0) : 0;
      const isIncome = amount < 0;
      const installments = extractInstallments(
        line,
        amountTok?.absX ?? 250,
        Math.abs(amount),
        isIncome,
      );
      current = {
        date: dateTok.text.trim(),
        y: line.y,
        page: dateTok.page ?? 0,
        desc: line.tokens
          .filter((t) => t.absX !== undefined && t.absX >= 140 && t.absX <= 225)
          .map((t) => t.text.trim()),
        amount,
        installments: installments.installments,
        installment_value: installments.installment_value,
      };
      continue;
    }

    if (!current) continue;
    const page = line.tokens[0]?.page;
    if (page !== undefined && page !== current.page) continue;
    if (line.y >= current.y) continue;
    const continuation = line.tokens
      .filter((t) => t.absX !== undefined && t.absX >= 140 && t.absX <= 225)
      .map((t) => t.text.trim());
    if (continuation.length > 0) current.desc.push(...continuation);
  }
  finalize();

  return {
    transactions: transactions.slice(0, MAX_TRANSACTIONS_PER_FILE),
    bank: 'rappicard',
    period,
  };
}

// Nu Bank: filas con fecha "DD MMM" (sin año, se infiere del período
// "01 - 31 JUL 2026"), descripción y monto con signo (+ ingreso / - gasto).
function parseNu(lines: TextLine[]): StatementParseResult {
  let year: number | undefined;
  let period: string | undefined;
  for (const line of lines) {
    const joined = line.tokens.map((t) => t.text).join(' ');
    const m = joined.match(
      /\b(\d{1,2})\s*-\s*(\d{1,2})\s+([a-záéíóúñ]{3,9})\s+(\d{4})\b/i,
    );
    if (m) {
      year = Number(m[4]);
      period = `${m[1]} - ${m[2]} ${m[3]} ${m[4]}`;
      break;
    }
  }
  const fallbackYear = new Date().getFullYear();

  const transactions: ParsedStatementTransaction[] = [];
  for (const line of lines) {
    const dateTok = line.tokens.find(
      (t) =>
        t.absX !== undefined &&
        t.absX < 100 &&
        /^\d{1,2}\s+[a-záéíóúñ]{3,9}$/i.test(t.text.trim()),
    );
    if (!dateTok) continue;
    const parts = dateTok.text.trim().split(/\s+/);
    const day = Number(parts[0]);
    const month = MONTH_MAP[parts[1].toLowerCase().slice(0, 3)];
    if (!month) continue;
    const date = buildDate(year ?? fallbackYear, month, day);
    if (!date) continue;

    const amountTok = line.tokens.find(
      (t) =>
        t.absX !== undefined && t.absX > 400 && parseAmount(t.text) !== null,
    );
    if (!amountTok) continue;
    const value = parseAmount(amountTok.text);
    if (value === null || value === 0) continue;

    const description = normalizeDescription(
      line.tokens
        .filter((t) => t.absX !== undefined && t.absX >= 100 && t.absX <= 400)
        .map((t) => t.text)
        .join(' '),
    );

    transactions.push({
      transaction_date: date,
      description: description || 'Movimiento bancario',
      amount: Math.abs(value),
      type:
        value < 0 ? TransactionTypeEnum.EXPENSE : TransactionTypeEnum.INCOME,
    });
  }

  return {
    transactions: transactions.slice(0, MAX_TRANSACTIONS_PER_FILE),
    bank: 'nu',
    period,
  };
}

// ── Parser principal ────────────────────────────────────────

/**
 * Reconoce el layout de extracto de cuenta (ahorros/corriente) Bancolombia:
 * cabecera FECHA | DESCRIPCIÓN | SUCURSAL | DCTO. | VALOR | SALDO y filas con
 * fecha "DD/MM" sin año. Es estructural, por lo que funciona aunque la entidad
 * configurada (DB) no coincida con el parser de tarjeta de crédito.
 */
function hasBancolombiaCuentaLayout(lines: TextLine[]): boolean {
  let hasYearlessDate = false;
  let hasHeader = false;
  for (const line of lines) {
    const texts = line.tokens.map((t) => t.text.trim());
    if (texts.some((t) => /^\d{1,2}\/\d{1,2}$/.test(t))) hasYearlessDate = true;
    if (
      texts.some((t) => /^DCTO/.test(t)) &&
      texts.some((t) => /^VALOR$/.test(t)) &&
      texts.some((t) => /^SALDO$/.test(t))
    ) {
      hasHeader = true;
    }
    if (hasYearlessDate && hasHeader) return true;
  }
  return false;
}

function nearest<T extends { x: number }>(
  tokens: T[],
  colX: number,
  maxDist: number,
): T | undefined {
  let best: T | undefined;
  let bestDist = Infinity;
  for (const t of tokens) {
    const d = Math.abs(t.x - colX);
    if (d <= maxDist && d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

// Bancolombia (cuenta de ahorros / corriente): tabla con columnas
// FECHA | DESCRIPCIÓN | SUCURSAL | DCTO. | VALOR | SALDO.
// Fechas "DD/MM" sin año: el año se infiere del período "DESDE: aaaa/mm/dd
// HASTA: aaaa/mm/dd". El VALOR va firmado (negativo = retiro/gasto,
// positivo = abono/ingreso) y la columna SALDO guarda el saldo acumulado.
function parseBancolombiaCuenta(lines: TextLine[]): StatementParseResult {
  let year: number | undefined;
  let period: string | undefined;

  for (const line of lines) {
    const joined = line.tokens.map((t) => t.text).join(' ');
    const m = joined.match(
      /DESDE:\s*(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\s+HASTA:\s*(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/i,
    );
    if (m) {
      year = Number(m[1]);
      period = `${m[1]}/${m[2]}/${m[3]} - ${m[4]}/${m[5]}/${m[6]}`;
      break;
    }
  }

  let colDescripcion = 130;
  let colValor = 434;
  let colSaldo = 534;
  for (const line of lines) {
    const texts = line.tokens.map((t) => t.text.trim());
    const isHeader =
      texts.some((t) => /^DCTO/.test(t)) &&
      texts.some((t) => /^VALOR$/.test(t)) &&
      texts.some((t) => /^SALDO$/.test(t));
    if (!isHeader) continue;
    for (const t of line.tokens) {
      const txt = t.text.trim();
      const absX = t.absX ?? 0;
      if (/^DESCRIPCIÓN|^DESCRIPCION/i.test(txt)) colDescripcion = absX;
      else if (/^VALOR$/.test(txt)) colValor = absX;
      else if (/^SALDO$/.test(txt)) colSaldo = absX;
    }
    break;
  }

  const fallbackYear = new Date().getFullYear();
  const transactions: ParsedStatementTransaction[] = [];

  for (const line of lines) {
    const dateTok = line.tokens.find(
      (t) =>
        t.absX !== undefined &&
        t.absX < 100 &&
        /^\d{1,2}\/\d{1,2}$/.test(t.text.trim()),
    );
    if (!dateTok) continue;
    const [dd, mm] = dateTok.text.trim().split('/').map(Number);
    const date = buildDate(year ?? fallbackYear, mm, dd);
    if (!date) continue;

    const numeric = line.tokens
      .filter(
        (t) =>
          t.absX !== undefined &&
          t.absX > colValor - 60 &&
          parseAmount(t.text) !== null,
      )
      .map((t) => ({
        x: t.absX as number,
        value: parseAmount(t.text) as number,
      }));

    const saldo = nearest(numeric, colSaldo, 60);
    const valor = nearest(
      numeric.filter((n) => saldo === undefined || n !== saldo),
      colValor,
      60,
    );
    if (!valor || valor.value === 0) continue;

    const description = normalizeDescription(
      line.tokens
        .filter(
          (t) =>
            t.absX !== undefined &&
            t.absX >= colDescripcion - 60 &&
            t.absX <= colValor - 40 &&
            t !== dateTok,
        )
        .map((t) => t.text)
        .join(' '),
    );

    const tx: ParsedStatementTransaction = {
      transaction_date: date,
      description: description || 'Movimiento bancario',
      amount: Math.abs(valor.value),
      type:
        valor.value < 0
          ? TransactionTypeEnum.EXPENSE
          : TransactionTypeEnum.INCOME,
    };
    if (saldo) tx.balance = Math.abs(saldo.value);
    transactions.push(tx);
  }

  return {
    transactions: transactions.slice(0, MAX_TRANSACTIONS_PER_FILE),
    bank: 'bancolombia',
    period,
  };
}

export function parseStatementLines(
  lines: TextLine[],
  defaultType?: TransactionTypeEnum,
  entities?: BankingEntityDetection[],
): StatementParseResult {
  const bank = detectBank(lines, entities);
  if (bank === 'bancolombia') {
    if (hasBancolombiaCuentaLayout(lines)) return parseBancolombiaCuenta(lines);
    return parseBancolombia(lines);
  }
  if (bank === 'rappicard') return parseRappiCard(lines);
  if (bank === 'nu') return parseNu(lines);
  if (hasBancolombiaCuentaLayout(lines)) return parseBancolombiaCuenta(lines);

  const layout = detectColumnLayout(lines);
  const transactions: ParsedStatementTransaction[] = [];

  let pendingDesc: string[] = [];
  let current: {
    date: string;
    descriptionTokens: TextToken[];
    numeric: { x: number; value: number; raw: string }[];
  } | null = null;

  const flushContinuation = () => {
    pendingDesc = [];
  };

  for (const line of lines) {
    const tokens = line.tokens;
    if (tokens.length === 0) continue;

    // ¿Cabecera/resumen? Salta.
    const joined = tokens.map((t) => t.text).join(' ');
    if (HEADER_NOISE.test(joined)) {
      flushContinuation();
      continue;
    }

    const dateIdx = tokens.findIndex(
      (t) => t.x < 0.6 && parseDateFromToken(t.text) !== null,
    );

    if (dateIdx !== -1) {
      // ── Inicia un nuevo movimiento ─────────────────────────
      const dateToken = tokens[dateIdx];
      const parsedDate = parseDateFromToken(dateToken.text)!;
      const date = parsedDate.date;

      // tokens a la izquierda del token de fecha → ignora (ruido)
      const left = tokens.slice(0, dateIdx);
      const rest = tokens.slice(dateIdx + 1);
      if (parsedDate.rest) {
        rest.unshift({ ...dateToken, text: parsedDate.rest });
      }

      const numeric: { x: number; value: number; raw: string }[] = [];
      const descTokens: TextToken[] = [];
      for (const tok of rest) {
        if (isNumericToken(tok)) {
          const value = parseAmount(tok.text);
          if (value !== null) numeric.push({ x: tok.x, value, raw: tok.text });
        } else {
          descTokens.push(tok);
        }
      }

      // Solo considera números a la derecha del texto (columna de montos).
      if (numeric.length > 0) {
        const numericStart = Math.min(...numeric.map((n) => n.x));
        const descTokensFiltered = descTokens.filter((t) => t.x < numericStart);
        // ruido a la izquierda de la fecha no es parte de la descripción
        if (current) {
          finalizeTransaction(
            current,
            transactions,
            layout,
            defaultType,
            pendingDesc.join(' '),
          );
        }
        current = {
          date,
          descriptionTokens: [...left, ...descTokensFiltered],
          numeric,
        };
        pendingDesc = [];
        continue;
      }
      // Línea con fecha pero sin montos → probable cabecera (ej: "FECHA DETALLE")
      flushContinuation();
      continue;
    }

    // ── Línea sin fecha ──────────────────────────────────────
    const numeric: { x: number; value: number; raw: string }[] = [];
    const textTokens: TextToken[] = [];
    for (const tok of tokens) {
      if (isNumericToken(tok)) {
        const value = parseAmount(tok.text);
        if (value !== null) numeric.push({ x: tok.x, value, raw: tok.text });
      } else if (/\S/.test(tok.text)) {
        textTokens.push(tok);
      }
    }

    if (numeric.length > 0 && current) {
      // continuación con montos → adjunta al movimiento actual
      current.numeric.push(...numeric);
      current.descriptionTokens.push(...textTokens);
      pendingDesc = [];
      continue;
    }

    if (textTokens.length > 0 && current) {
      // continuación de descripción
      const text = textTokens.map((t) => t.text).join(' ');
      if (/[a-záéíóúñ0-9]/i.test(text)) pendingDesc.push(text);
    }
  }

  if (current) {
    finalizeTransaction(
      current,
      transactions,
      layout,
      defaultType,
      pendingDesc.join(' '),
    );
  }

  const result: StatementParseResult = {
    transactions: transactions.slice(0, MAX_TRANSACTIONS_PER_FILE),
  };
  if (bank) result.bank = bank;
  return result;
}

function finalizeTransaction(
  current: {
    date: string;
    descriptionTokens: TextToken[];
    numeric: { x: number; value: number; raw: string }[];
  },
  transactions: ParsedStatementTransaction[],
  layout: ColumnLayout,
  defaultType?: TransactionTypeEnum,
  continuation = '',
): void {
  const description = normalizeDescription(
    `${current.descriptionTokens.map((t) => t.text).join(' ')} ${continuation}`,
  );

  const movement = classifyMovement(
    current.numeric,
    layout,
    description,
    defaultType,
  );

  if (!movement || movement.amount <= 0) return;

  const tx: ParsedStatementTransaction = {
    transaction_date: current.date,
    description: description || 'Movimiento bancario',
    amount: movement.amount,
    type: movement.type,
  };
  if (movement.balance !== undefined) tx.balance = movement.balance;
  const ref = extractReference(description);
  if (ref) tx.reference = ref;

  transactions.push(tx);
}

/**
 * Carga rápida: extrae texto del PDF y lo interpreta como extracto.
 */
export async function parsePdfStatement(
  buffer: Buffer,
  password?: string,
  defaultType?: TransactionTypeEnum,
  entities?: BankingEntityDetection[],
): Promise<StatementParseResult> {
  const lines = await extractTextLines(buffer, password);
  return parseStatementLines(lines, defaultType, entities);
}
