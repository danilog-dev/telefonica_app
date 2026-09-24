import { NextRequest, NextResponse } from 'next/server';
import {
  getGoogleSheetsClient,
  getSpreadsheetId,
  SHEET_CONFIGS,
} from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    // 1. Validar autenticación con x-admin-password
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = req.headers.get('x-admin-password');

    if (!adminPassword || providedPassword !== adminPassword) {
      return NextResponse.json(
        { error: 'No autorizado. Se requiere x-admin-password válido.' },
        { status: 401 }
      );
    }

    // 2. Conectar a Google Sheets y leer la hoja 'Números'
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = getSpreadsheetId();
    const sheetName = 'Números';
    const config = SHEET_CONFIGS[sheetName];

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:Z`,
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const rows = response.data.values || [];

    if (rows.length <= 1) {
      return NextResponse.json({
        success: true,
        message: 'No hay filas de datos para limpiar en la hoja Números.',
        removedCount: 0,
        remainingCount: 0,
      });
    }

    const header = rows[0];
    const dataRows = rows.slice(1);

    const p1RtaCol = config.passColumns[1].responseColIndex;
    const p2RtaCol = config.passColumns[2].responseColIndex;
    const p3RtaCol = config.passColumns[3].responseColIndex;

    const isFS = (val: unknown): boolean => {
      if (!val) return false;
      return String(val).trim().toUpperCase() === 'FS';
    };

    // 3. Filtrar filas eliminando las que tienen 'FS' en las tres pasadas consecutivas
    const cleanedDataRows: (string | boolean | number)[][] = [];
    let removedCount = 0;

    for (const row of dataRows) {
      // Ignorar filas completamente vacías al final
      const hasAnyData = row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== '');
      if (!hasAnyData) {
        continue;
      }

      const hasThreeConsecutiveFS =
        isFS(row[p1RtaCol]) &&
        isFS(row[p2RtaCol]) &&
        isFS(row[p3RtaCol]);

      if (hasThreeConsecutiveFS) {
        removedCount++;
      } else {
        cleanedDataRows.push(row);
      }
    }

    // 4. Si se eliminaron filas, actualizar la hoja en Google Sheets
    if (removedCount > 0) {
      // Limpiar el rango actual para evitar filas residuales
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${sheetName}'!A:Z`,
      });

      // Escribir los datos filtrados comenzando en A1
      const updatedValues = [header, ...cleanedDataRows];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: updatedValues,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Limpieza completada. Se eliminaron ${removedCount} filas con 'FS' en las 3 pasadas.`,
      removedCount,
      remainingCount: cleanedDataRows.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error en POST /api/admin/clean-fs:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: err.message },
      { status: 500 }
    );
  }
}
