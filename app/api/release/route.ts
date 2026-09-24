import { NextRequest, NextResponse } from 'next/server';
import { releaseLock, getLockKey, SheetType } from '@/lib/sheets';

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

    // 2. Parsear cuerpo de la petición
    const body = await req.json();
    const { sheetType, rowNumber } = body as {
      sheetType?: SheetType;
      rowNumber?: number;
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

    // 3. Liberar el bloqueo en memoria
    const lockKey = getLockKey(sheetType, rowNumber);
    releaseLock(lockKey);

    return NextResponse.json({
      success: true,
      message: `Bloqueo liberado para ${sheetType} fila ${rowNumber}.`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Error en POST /api/release:', err);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: err.message },
      { status: 500 }
    );
  }
}
