import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleSheetsClient,
  getSpreadsheetId,
  SHEET_CONFIGS,
  SheetType,
  releaseLock,
  getLockKey,
} from '@/lib/sheets';

const VALID_RTAS = ['OK', '!', 'FS'] as const;
type ValidRta = (typeof VALID_RTAS)[number];

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación con x-app-password
    const appPassword = process.env.APP_PASSWORD;
    const providedPassword = req.headers.get('x-app-password');

    if (!appPassword || providedPassword !== appPassword) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere x-app-password válido.' },
        { status: 401 }
      );
    }

    // 2. Parsear y validar cuerpo de la petición
    const body = await req.json();
    const { sheetType, rowNumber, pass, rta } = body as {
      sheetType?: SheetType;
      rowNumber?: number;
      pass?: number;
      rta?: ValidRta;
    };

    if (
      !sheetType ||
      (sheetType !== 'Números' && sheetType !== 'Edificios Restringidos')
    ) {
      return NextResponse.json(
        { error: 'sheetType debe ser "Números" o "Edificios Restringidos".' },
        { status: 400 }
      );
    }

    if (typeof rowNumber !== 'number' || rowNumber < 2) {
      return NextResponse.json(
        { error: 'rowNumber debe ser un número entero mayor o igual a 2.' },
        { status: 400 }
      );
    }

    if (!pass || ![1, 2, 3].includes(pass)) {
      return NextResponse.json(
        { error: 'pass debe ser 1, 2 o 3.' },
        { status: 400 }
      );
    }

    if (!rta || !VALID_RTAS.includes(rta)) {
      return NextResponse.json(
        { error: 'rta debe ser uno de los siguientes valores: "OK", "!", "FS".' },
        { status: 400 }
      );
    }

    // 3. Determinar columnas a actualizar
    const config = SHEET_CONFIGS[sheetType];
    const passConfig = config.passColumns[pass];
    const startCol = passConfig.checkboxColLetter;
    const endCol = passConfig.responseColLetter;

    const range = `'${sheetType}'!${startCol}${rowNumber}:${endCol}${rowNumber}`;

    // 4. Actualizar en Google Sheets
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[true, rta]],
      },
    });

    // 5. Liberar el bloqueo en memoria inmediatamente
    const lockKey = getLockKey(sheetType, rowNumber);
    releaseLock(lockKey);

    return NextResponse.json({
      success: true,
      message: 'Registro guardado y bloqueo liberado exitosamente.',
      data: {
        sheetType,
        rowNumber,
        pass,
        rta,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error en POST /api/record:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: err.message },
      { status: 500 }
    );
  }
}
