import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleSheetsClient,
  getSpreadsheetId,
  SHEET_CONFIGS,
  SheetType,
  isCheckboxChecked,
  acquireLock,
  getLockKey,
} from '@/lib/sheets';

export async function GET(req: NextRequest) {
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

    // 2. Obtener parámetro de hoja (?sheet=)
    const { searchParams } = new URL(req.url);
    const requestedSheet = searchParams.get('sheet');
    const sheetType: SheetType =
      requestedSheet === 'Edificios Restringidos'
        ? 'Edificios Restringidos'
        : 'Números';

    const config = SHEET_CONFIGS[sheetType];

    // 3. Conectar a Google Sheets y leer datos
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = getSpreadsheetId();

    const range = `'${sheetType}'!A:L`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rows = response.data.values || [];

    if (rows.length <= 1) {
      return NextResponse.json({
        available: false,
        message: 'La hoja no contiene registros o solo tiene encabezados.',
      });
    }

    // 4. Evaluar pasadas: Pasada 1, luego Pasada 2, luego Pasada 3
    for (const pass of [1, 2, 3]) {
      const passConfig = config.passColumns[pass];
      const checkboxIndex = passConfig.checkboxColIndex;

      // Verificar si en esta pasada aún existen filas no marcadas
      const pendingRowsInPass: number[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        // Ignorar filas totalmente vacías
        const hasData = row && row.some((cell: unknown) => cell !== undefined && cell !== null && String(cell).trim() !== '');
        if (!hasData) continue;

        const isChecked = isCheckboxChecked(row[checkboxIndex]);
        if (!isChecked) {
          pendingRowsInPass.push(i);
        }
      }

      // Si hay filas pendientes en esta pasada, esta es la pasada activa
      if (pendingRowsInPass.length > 0) {
        // Buscar la primera fila disponible que no esté bloqueada
        for (const rowIndex of pendingRowsInPass) {
          const rowNumber = rowIndex + 1; // Google Sheets es 1-indexed
          const lockKey = getLockKey(sheetType, rowNumber);

          const locked = acquireLock(lockKey, 15);
          if (locked) {
            const row = rows[rowIndex];

            const baseData: Record<string, unknown> = {
              nombre: row[config.nameCol] ?? '',
              direccion: row[config.addressCol] ?? '',
              telefono: row[config.phoneCol] ?? '',
              t: row[config.tempCol] ?? '',
              notas: row[config.notesCol] ?? '',
              p1_check: isCheckboxChecked(row[config.passColumns[1].checkboxColIndex]),
              p1_rta: row[config.passColumns[1].responseColIndex] ?? '',
              p2_check: isCheckboxChecked(row[config.passColumns[2].checkboxColIndex]),
              p2_rta: row[config.passColumns[2].responseColIndex] ?? '',
              p3_check: isCheckboxChecked(row[config.passColumns[3].checkboxColIndex]),
              p3_rta: row[config.passColumns[3].responseColIndex] ?? '',
            };

            if (sheetType === 'Edificios Restringidos' && config.floorCol !== undefined) {
              baseData.piso = row[config.floorCol] ?? '';
            }

            return NextResponse.json({
              available: true,
              sheetType,
              rowNumber,
              pass,
              data: baseData,
              ...baseData,
            });
          }
        }

        // Si todas las filas pendientes de esta pasada están bloqueadas actualmente
        return NextResponse.json({
          available: false,
          sheetType,
          pass,
          message: `Todos los registros pendientes de la Pasada ${pass} están bloqueados temporalmente por otros usuarios. Intente en unos minutos.`,
        });
      }
    }

    // Si no quedan pasadas pendientes
    return NextResponse.json({
      available: false,
      sheetType,
      message: 'Territorio completado en todas las pasadas (1, 2 y 3).',
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error en GET /api/next:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: err.message },
      { status: 500 }
    );
  }
}
