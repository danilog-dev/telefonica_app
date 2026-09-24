import { google } from 'googleapis';

// --- In-Memory Lock Management (15 minutes) ---
const globalForLocks = globalThis as unknown as {
  sheetLocks?: Map<string, number>;
};

const locks = globalForLocks.sheetLocks ?? new Map<string, number>();
if (process.env.NODE_ENV !== 'production') {
  globalForLocks.sheetLocks = locks;
}

/**
 * Genera la clave única para el bloqueo de una fila en una hoja dada.
 */
export function getLockKey(sheetType: string, rowNumber: number): string {
  return `${sheetType}:${rowNumber}`;
}

/**
 * Intenta adquirir un bloqueo en memoria para una clave específica.
 * @param key Clave única que identifica el recurso bloqueado.
 * @param durationMin Duración del bloqueo en minutos (por defecto 15).
 * @returns true si el lock se adquirió exitosamente, false si ya estaba bloqueado y activo.
 */
export function acquireLock(key: string, durationMin = 15): boolean {
  const now = Date.now();
  const existingExpiration = locks.get(key);

  if (existingExpiration && existingExpiration > now) {
    return false;
  }

  const expiration = now + durationMin * 60 * 1000;
  locks.set(key, expiration);
  return true;
}

/**
 * Libera inmediatamente el bloqueo en memoria para la clave dada.
 * @param key Clave única que identifica el recurso.
 */
export function releaseLock(key: string): void {
  locks.delete(key);
}

/**
 * Consulta si una clave está actualmente bloqueada y activa.
 */
export function isLocked(key: string): boolean {
  const now = Date.now();
  const existingExpiration = locks.get(key);
  if (!existingExpiration) return false;
  if (existingExpiration <= now) {
    locks.delete(key);
    return false;
  }
  return true;
}

// --- Sheet Configuration & Mappings ---
export type SheetType = 'Números' | 'Edificios Restringidos';

export interface PassColConfig {
  checkboxColIndex: number;
  checkboxColLetter: string;
  responseColIndex: number;
  responseColLetter: string;
}

export interface SheetConfig {
  nameCol: number;
  addressCol: number;
  floorCol?: number;
  phoneCol: number;
  tempCol: number;
  notesCol: number;
  passColumns: Record<number, PassColConfig>;
}

export const SHEET_CONFIGS: Record<SheetType, SheetConfig> = {
  'Números': {
    nameCol: 0,     // A: Nombre
    addressCol: 1,  // B: Dirección
    phoneCol: 2,    // C: Teléfono
    tempCol: 3,     // D: T°
    notesCol: 4,    // E: Notas
    passColumns: {
      1: { checkboxColIndex: 5, checkboxColLetter: 'F', responseColIndex: 6, responseColLetter: 'G' },
      2: { checkboxColIndex: 7, checkboxColLetter: 'H', responseColIndex: 8, responseColLetter: 'I' },
      3: { checkboxColIndex: 9, checkboxColLetter: 'J', responseColIndex: 10, responseColLetter: 'K' },
    },
  },
  'Edificios Restringidos': {
    nameCol: 0,     // A: Nombre
    addressCol: 1,  // B: Dirección
    floorCol: 2,    // C: Piso
    phoneCol: 3,    // D: Teléfono
    tempCol: 4,     // E: T°
    notesCol: 5,    // F: Notas
    passColumns: {
      1: { checkboxColIndex: 6, checkboxColLetter: 'G', responseColIndex: 7, responseColLetter: 'H' },
      2: { checkboxColIndex: 8, checkboxColLetter: 'I', responseColIndex: 9, responseColLetter: 'J' },
      3: { checkboxColIndex: 10, checkboxColLetter: 'K', responseColIndex: 11, responseColLetter: 'L' },
    },
  },
};

/**
 * Evalúa si una celda de casilla de verificación está marcada (TRUE).
 */
export function isCheckboxChecked(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim().toUpperCase();
    return trimmed === 'TRUE' || trimmed === 'VERDADERO';
  }
  return false;
}

// --- Google Sheets API Client ---
export function getGoogleSheetsClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Credenciales de Google Sheets no encontradas. Verifique GOOGLE_CLIENT_EMAIL y GOOGLE_PRIVATE_KEY en las variables de entorno.'
    );
  }

  // Quitar comillas si están incluidas en el string
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  // Normalizar saltos de línea escapados
  privateKey = privateKey.replace(/\\n/g, '\n');

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export function getSpreadsheetId(): string {
  const id = process.env.SPREADSHEET_ID;
  if (!id) {
    throw new Error('SPREADSHEET_ID no está definido en las variables de entorno.');
  }
  return id;
}
