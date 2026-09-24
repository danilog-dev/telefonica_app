'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

type SheetType = 'Números' | 'Edificios Restringidos';

interface ContactData {
  rowNumber: number;
  sheetType: SheetType;
  pass: number;
  nombre?: string;
  direccion?: string;
  piso?: string;
  telefono?: string;
  t?: string | number;
}

interface MessageBanner {
  type: 'info' | 'error' | 'success';
  text: string;
}

export default function HomePage() {
  // Authentication
  const [password, setPassword] = useState<string>('');
  const [inputPassword, setInputPassword] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [logoutNotice, setLogoutNotice] = useState<string>('');

  // Territory state
  const [sheetType, setSheetType] = useState<SheetType>('Números');
  const [contact, setContact] = useState<ContactData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<MessageBanner | null>(null);

  // Admin state
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [adminMessage, setAdminMessage] = useState<MessageBanner | null>(null);

  // Keep a ref to active contact & password for release on unload
  const contactRef = useRef<ContactData | null>(null);
  const passwordRef = useRef<string>('');

  useEffect(() => {
    contactRef.current = contact;
  }, [contact]);

  useEffect(() => {
    passwordRef.current = password;
  }, [password]);

  // Release lock helper
  const releaseCurrentContact = useCallback(
    async (contactToRelease?: ContactData | null, pwdOverride?: string): Promise<boolean> => {
      const target = contactToRelease ?? contactRef.current;
      const pwd = pwdOverride ?? passwordRef.current;

      if (!target || !pwd) return true;

      try {
        await fetch('/api/release', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-app-password': pwd,
          },
          body: JSON.stringify({
            sheetType: target.sheetType,
            rowNumber: target.rowNumber,
          }),
        });
        return true;
      } catch (err) {
        console.error('Error al liberar contacto:', err);
        return false;
      }
    },
    []
  );

  // Fetch next contact
  const fetchNextContact = useCallback(
    async (targetSheet?: SheetType, pwdOverride?: string) => {
      const activeSheet = targetSheet || sheetType;
      const activePwd = pwdOverride || passwordRef.current;

      if (!activePwd) return;

      setLoading(true);
      setStatusMessage(null);

      try {
        const res = await fetch(`/api/next?sheet=${encodeURIComponent(activeSheet)}`, {
          method: 'GET',
          headers: {
            'x-app-password': activePwd,
          },
        });

        if (res.status === 401) {
          localStorage.removeItem('territorio_app_password');
          setIsAuthenticated(false);
          setPassword('');
          setAuthError('Contraseña incorrecta o sesión expirada.');
          return;
        }

        const data = await res.json();

        if (!res.ok) {
          setStatusMessage({
            type: 'error',
            text: data.details || data.error || 'Error al conectar con el servidor.',
          });
          return;
        }

        if (data.available && data.rowNumber) {
          setContact({
            rowNumber: data.rowNumber,
            sheetType: data.sheetType || activeSheet,
            pass: data.pass,
            nombre: data.nombre || data.data?.nombre || '',
            direccion: data.direccion || data.data?.direccion || '',
            piso: data.piso || data.data?.piso || '',
            telefono: data.telefono || data.data?.telefono || '',
            t: data.t ?? data.data?.t ?? '',
          });
        } else {
          setContact(null);
          setStatusMessage({
            type: 'info',
            text: data.message || 'No hay contactos disponibles en esta lista.',
          });
        }
      } catch (err: unknown) {
        const error = err as Error;
        setContact(null);
        setStatusMessage({
          type: 'error',
          text: `Error de red: ${error.message || 'No se pudo contactar al servidor.'}`,
        });
      } finally {
        setLoading(false);
      }
    },
    [sheetType]
  );

  // Load password from localStorage on mount & auto-load first contact
  useEffect(() => {
    const savedPassword = localStorage.getItem('territorio_app_password');
    if (savedPassword) {
      setPassword(savedPassword);
      passwordRef.current = savedPassword;
      setIsAuthenticated(true);
      // Auto-load first number immediately on authenticated load
      fetchNextContact('Números', savedPassword);
    }
  }, [fetchNextContact]);

  // Cleanup on tab close / reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (contactRef.current && passwordRef.current) {
        const payload = JSON.stringify({
          sheetType: contactRef.current.sheetType,
          rowNumber: contactRef.current.rowNumber,
        });
        try {
          fetch('/api/release', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-app-password': passwordRef.current,
            },
            body: payload,
            keepalive: true,
          });
        } catch {
          // ignore error on unload
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPassword.trim()) {
      setAuthError('Por favor ingrese la contraseña.');
      return;
    }
    const cleanPwd = inputPassword.trim();
    localStorage.setItem('territorio_app_password', cleanPwd);
    setPassword(cleanPwd);
    passwordRef.current = cleanPwd;
    setIsAuthenticated(true);
    setAuthError('');
    setLogoutNotice('');
    setInputPassword('');

    // Auto-load first number immediately upon login
    fetchNextContact(sheetType, cleanPwd);
  };

  // Exit application / Logout handler
  const handleExitApp = async () => {
    if (contact) {
      await releaseCurrentContact(contact);
    }
    localStorage.removeItem('territorio_app_password');
    setPassword('');
    passwordRef.current = '';
    setIsAuthenticated(false);
    setContact(null);
    setStatusMessage(null);
    setLogoutNotice('Sesión cerrada. El contacto fue liberado y volvió a quedar disponible.');
  };

  // Switch sheet type
  const handleSheetChange = async (newSheet: SheetType) => {
    if (newSheet === sheetType) return;

    if (contact) {
      setLoading(true);
      await releaseCurrentContact(contact);
      setContact(null);
    }

    setSheetType(newSheet);
    setStatusMessage(null);

    // Auto-fetch first number of the newly selected sheet
    fetchNextContact(newSheet);
  };

  // Manual release without recording
  const handleManualRelease = async () => {
    if (!contact) return;
    setLoading(true);
    await releaseCurrentContact(contact);
    setContact(null);
    setStatusMessage({
      type: 'info',
      text: 'El contacto fue liberado y volvió a quedar disponible en la lista.',
    });
    setLoading(false);
  };

  // Record outcome and auto-load next
  const handleRecord = async (rta: 'OK' | '!' | 'FS') => {
    if (!contact) return;

    setSubmittingAction(rta);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-password': password,
        },
        body: JSON.stringify({
          sheetType: contact.sheetType,
          rowNumber: contact.rowNumber,
          pass: contact.pass,
          rta,
        }),
      });

      if (res.status === 401) {
        localStorage.removeItem('territorio_app_password');
        setIsAuthenticated(false);
        setPassword('');
        setAuthError('Contraseña incorrecta o sesión expirada.');
        return;
      }

      const result = await res.json();

      if (!res.ok) {
        setStatusMessage({
          type: 'error',
          text: result.details || result.error || 'Error al guardar el resultado.',
        });
        return;
      }

      // Contact was recorded & released on server
      setContact(null);

      // Auto-load next contact
      await fetchNextContact();
    } catch (err: unknown) {
      const error = err as Error;
      setStatusMessage({
        type: 'error',
        text: `Error al guardar respuesta: ${error.message}`,
      });
    } finally {
      setSubmittingAction(null);
    }
  };

  // Admin clean FS
  const handleCleanFs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setAdminMessage({ type: 'error', text: 'Ingrese la clave de administrador.' });
      return;
    }

    setAdminLoading(true);
    setAdminMessage(null);

    try {
      const res = await fetch('/api/admin/clean-fs', {
        method: 'POST',
        headers: {
          'x-admin-password': adminPassword.trim(),
        },
      });

      const data = await res.json();

      if (res.status === 401) {
        setAdminMessage({ type: 'error', text: 'Clave de administrador incorrecta.' });
        return;
      }

      if (!res.ok) {
        setAdminMessage({
          type: 'error',
          text: data.details || data.error || 'Error al ejecutar la limpieza.',
        });
        return;
      }

      setAdminMessage({
        type: 'success',
        text: `Operación exitosa: Se eliminaron ${data.removedCount} fila(s) con 3 FS. Filas restantes: ${data.remainingCount}.`,
      });
      setAdminPassword('');
    } catch (err: unknown) {
      const error = err as Error;
      setAdminMessage({
        type: 'error',
        text: `Error de conexión: ${error.message}`,
      });
    } finally {
      setAdminLoading(false);
    }
  };

  // ==================== RENDER: LOGIN STATE ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-700 mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Territorio Telefónico
            </h1>
            <p className="text-sm text-slate-500">
              Ingrese la clave de acceso para comenzar
            </p>
          </div>

          {logoutNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-emerald-600 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>{logoutNotice}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:bg-white text-base transition-all"
                autoComplete="current-password"
                required
              />
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98] text-base cursor-pointer"
            >
              Ingresar
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== RENDER: AUTHENTICATED STATE ====================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-sm font-bold text-slate-800 tracking-tight">
              Territorio Telefónico
            </span>
          </div>

          {/* Redesigned Exit Button */}
          <button
            onClick={handleExitApp}
            className="text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 py-1.5 px-3 rounded-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            title="Salir de la aplicación y liberar contacto"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5 text-rose-600 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Salir de la aplicación</span>
          </button>
        </div>

        {/* List Selector Tabs */}
        <div className="max-w-md mx-auto px-4 pb-2.5 pt-1">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1">
            <button
              onClick={() => handleSheetChange('Números')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                sheetType === 'Números'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Lista General
            </button>
            <button
              onClick={() => handleSheetChange('Edificios Restringidos')}
              className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                sheetType === 'Edificios Restringidos'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Edificios Restringidos
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto w-full flex-1 p-4 flex flex-col justify-start">
        {/* Status Notification Banner */}
        {statusMessage && (
          <div
            className={`mb-4 p-3.5 rounded-xl border text-sm font-medium transition-all ${
              statusMessage.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Loading State when fetching next number */}
        {loading && !contact ? (
          <div className="my-auto py-12 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-slate-600">
              <svg
                className="animate-spin h-7 w-7 text-slate-700"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-slate-800">
                Buscando siguiente contacto...
              </h2>
              <p className="text-xs text-slate-500">
                Consultando lista: <span className="font-semibold">{sheetType}</span>
              </p>
            </div>
          </div>
        ) : !contact ? (
          /* Fallback State: No Contact Assigned (Only shown if list is empty or after error) */
          <div className="my-auto py-8 text-center space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-slate-600">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-7 h-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-slate-800">
                  Sin contacto asignado
                </h2>
                <p className="text-sm text-slate-500">
                  Lista actual:{' '}
                  <span className="font-semibold text-slate-700">
                    {sheetType}
                  </span>
                </p>
              </div>

              <button
                onClick={() => fetchNextContact()}
                disabled={loading}
                className="w-full py-4 px-6 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-semibold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.98] text-base flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Buscando siguiente contacto...</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                      />
                    </svg>
                    <span>Obtener Siguiente Contacto</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Active State: Contact Assigned */
          <div className="space-y-4 my-auto py-2">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-4">
              {/* Badges Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  Pasada {contact.pass} de 3
                </span>

                {contact.sheetType === 'Edificios Restringidos' && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Edificio Restringido
                  </span>
                )}

                {contact.t && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    T° {contact.t}
                  </span>
                )}
              </div>

              {/* Contact Information (Notas removed as requested) */}
              <div className="space-y-2 pt-1">
                <h2 className="text-2xl font-bold text-slate-800 leading-tight">
                  {contact.nombre || '(Sin Nombre)'}
                </h2>

                <div className="space-y-1 text-sm text-slate-600">
                  <div className="flex items-start gap-2">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 text-slate-400 mt-0.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    <span className="font-medium text-slate-700">
                      {contact.direccion || 'Sin dirección registrada'}
                      {contact.piso ? ` • Piso: ${contact.piso}` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Main Call Button */}
              {contact.telefono ? (
                <a
                  href={`tel:${contact.telefono}`}
                  className="w-full py-4 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-2xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-3 text-center cursor-pointer select-none"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-7 h-7"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  <span>{contact.telefono}</span>
                </a>
              ) : (
                <div className="p-4 bg-slate-100 rounded-xl text-center text-slate-500 font-semibold">
                  (Sin teléfono registrado)
                </div>
              )}

              {/* Release contact without recording */}
              <div className="text-center pt-1">
                <button
                  onClick={handleManualRelease}
                  disabled={loading || submittingAction !== null}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600 underline underline-offset-4 py-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Liberar / Salir de este contacto
                </button>
              </div>
            </div>

            {/* Bottom Outcome Buttons with Highlighted Header */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-200/80 border border-slate-300 rounded-xl shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                <p className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider text-center">
                  Registrar resultado de llamada:
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Atendió -> 'OK' */}
                <button
                  onClick={() => handleRecord('OK')}
                  disabled={submittingAction !== null}
                  className="py-3.5 px-2 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-300 text-emerald-800 font-bold rounded-xl text-sm flex flex-col items-center justify-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-emerald-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Atendió</span>
                </button>

                {/* No atendió -> '!' */}
                <button
                  onClick={() => handleRecord('!')}
                  disabled={submittingAction !== null}
                  className="py-3.5 px-2 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border border-amber-300 text-amber-800 font-bold rounded-xl text-sm flex flex-col items-center justify-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-amber-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>No atendió</span>
                </button>

                {/* Fuera de servicio -> 'FS' */}
                <button
                  onClick={() => handleRecord('FS')}
                  disabled={submittingAction !== null}
                  className="py-3.5 px-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-300 text-rose-800 font-bold rounded-xl text-sm flex flex-col items-center justify-center gap-1 shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-5 h-5 text-rose-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span>Fuera de servicio</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Admin Accordion */}
      <footer className="max-w-md mx-auto w-full p-4 pt-0">
        <div className="border-t border-slate-200 pt-3">
          <button
            onClick={() => {
              setIsAdminOpen(!isAdminOpen);
              setAdminMessage(null);
            }}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-700 py-1.5 transition-colors cursor-pointer"
          >
            <span>Opciones de Administrador</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-4 h-4 transform transition-transform ${
                isAdminOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isAdminOpen && (
            <div className="mt-3 p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
              <p className="text-xs text-slate-600">
                Depurar filas de la lista <strong>Números</strong> que tengan resultado{' '}
                <strong>FS</strong> en las 3 pasadas consecutivas.
              </p>

              <form onSubmit={handleCleanFs} className="space-y-3">
                <div>
                  <input
                    type="password"
                    placeholder="Clave de Administrador"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-700"
                  />
                </div>

                {adminMessage && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium ${
                      adminMessage.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {adminMessage.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={adminLoading}
                  className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {adminLoading ? 'Procesando...' : 'Depurar contactos con 3 FS'}
                </button>
              </form>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
