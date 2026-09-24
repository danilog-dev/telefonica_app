# 📞 Territorio Telefónico

Aplicación web *mobile-first* de alto rendimiento diseñada para la gestión organizada, rápida y colaborativa de territorios de predicación o contacto telefónico. 

El sistema utiliza **Google Sheets** como base de datos en tiempo real (evitando bases de datos SQL de pago), un backend serverless en **Next.js (App Router)** y un mecanismo de **bloqueo temporal en memoria (15 min)** para evitar llamadas duplicadas entre publicadores concurrentes.

---

## 🚀 Características Principales

- **📱 Diseño Mobile-First Sobrio y Formal:** Optimizado para pantallas de smartphones con botones táctiles grandes, alta legibilidad y navegación fluida.
- **🔄 Pasadas Progresivas (1, 2 y 3):** Evalúa automáticamente el territorio por pasada activa antes de avanzar a la siguiente.
- **🔒 Bloqueo en Memoria Anticolisión (15 min):** Cuando un usuario solicita un contacto, este queda retenido durante 15 minutos para evitar que otros usuarios llamen al mismo número al mismo tiempo.
- **⚡ Liberación Inmediata y Automática:** Al calificar la llamada (*Atendió*, *No atendió*, *Fuera de servicio*), al cambiar de lista, cerrar sesión o salir de la ventana, el contacto se libera o registra de inmediato.
- **🏢 Soporte Multilista:** Gestión diferenciada para **Lista General** (`Números`) y **Edificios Restringidos** (con campo de piso/departamento).
- **🧹 Panel Administrativo de Limpieza:** Depuración en un solo clic de registros que acumulen `FS` (Fuera de Servicio) en las 3 pasadas consecutivas.
- **💸 Costo $0 (Free Tier Perpetuo):** Funciona al 100% dentro de los límites gratuitos de Vercel y Google Cloud Console / Google Sheets API.

---

## 🛠️ Arquitectura Técnica

- **Framework Frontend/Backend:** [Next.js](https://nextjs.org/) (App Router, React 19, TypeScript).
- **Estilos:** [Tailwind CSS v4](https://tailwindcss.com/) (Paleta Slate, interfaz limpia, minimalista y accesible).
- **Persistencia y Base de Datos:** [Google Sheets API v4](https://developers.google.com/sheets/api) mediante cuenta de servicio oficial (`googleapis`).
- **Autenticación Ligera:** Validación de cabeceras seguras (`x-app-password` y `x-admin-password`).
- **Despliegue:** [Vercel](https://vercel.com/) (Serverless Functions y Edge Network global).

---

## 📊 Estructura y Mapeo de Google Sheets

El libro de Google Sheets debe contener dos hojas (pestañas) con las siguientes columnas exactas:

### 1. Hoja: `Números` (Lista General)

| Columna | Letra | Nombre de Campo | Descripción |
|---|---|---|---|
| 0 | **A** | `Nombre` | Nombre del contacto |
| 1 | **B** | `Dirección` | Calle y numeración |
| 2 | **C** | `Teléfono` | Número de contacto directo |
| 3 | **D** | `T°` | Identificador de territorio |
| 4 | **E** | `Notas` | Observaciones especiales |
| 5 | **F** | `☎️` *(Pasada 1)* | Casilla de verificación (TRUE/FALSE) |
| 6 | **G** | `Rta` *(Pasada 1)* | Resultado de llamada (`OK`, `!`, `FS`) |
| 7 | **H** | `☎️` *(Pasada 2)* | Casilla de verificación (TRUE/FALSE) |
| 8 | **I** | `Rta` *(Pasada 2)* | Resultado de llamada (`OK`, `!`, `FS`) |
| 9 | **J** | `☎️` *(Pasada 3)* | Casilla de verificación (TRUE/FALSE) |
| 10 | **K** | `Rta` *(Pasada 3)* | Resultado de llamada (`OK`, `!`, `FS`) |

---

### 2. Hoja: `Edificios Restringidos`

| Columna | Letra | Nombre de Campo | Descripción |
|---|---|---|---|
| 0 | **A** | `Nombre` | Nombre del contacto / depto |
| 1 | **B** | `Dirección` | Dirección del edificio |
| 2 | **C** | `Piso` | Piso / Departamento / Unidad |
| 3 | **D** | `Teléfono` | Número de contacto |
| 4 | **E** | `T°` | Identificador de territorio |
| 5 | **F** | `Notas` | Observaciones de acceso/portería |
| 6 | **G** | `☎️` *(Pasada 1)* | Casilla de verificación (TRUE/FALSE) |
| 7 | **H** | `Rta` *(Pasada 1)* | Resultado de llamada (`OK`, `!`, `FS`) |
| 8 | **I** | `☎️` *(Pasada 2)* | Casilla de verificación (TRUE/FALSE) |
| 9 | **J** | `Rta` *(Pasada 2)* | Resultado de llamada (`OK`, `!`, `FS`) |
| 10 | **K** | `☎️` *(Pasada 3)* | Casilla de verificación (TRUE/FALSE) |
| 11 | **L** | `Rta` *(Pasada 3)* | Resultado de llamada (`OK`, `!`, `FS`) |

> **Nota:** La fila 1 se reserva para los encabezados. Las filas de datos comienzan a partir de la fila 2.

---

## 🔑 Guía de Configuración: Google Cloud & Service Account

Para conectar la aplicación con tu hoja de cálculo sin pagar nada:

1. **Crear un Proyecto en Google Cloud:**
   - Entra a [Google Cloud Console](https://console.cloud.google.com/).
   - Crea un nuevo proyecto (ej. `territorio-telefonico`).
2. **Habilitar Google Sheets API:**
   - Ve a **APIs & Services > Library**.
   - Busca **Google Sheets API** y haz clic en **Enable** (Habilitar).
3. **Crear la Cuenta de Servicio (Service Account):**
   - Ve a **APIs & Services > Credentials**.
   - Haz clic en **Create Credentials > Service Account**.
   - Asigna un nombre (ej. `sheets-writer`) y finaliza el asistente.
4. **Generar y Descargar la Clave Privada:**
   - En la lista de Cuentas de Servicio, haz clic sobre la cuenta creada.
   - Ve a la pestaña **Keys > Add Key > Create new key**.
   - Selecciona el formato **JSON** y descarga el archivo a tu computadora.
5. **Compartir la Hoja de Google Sheets:**
   - Abre tu hoja de Google Sheets en el navegador.
   - Copia la dirección de correo de la Cuenta de Servicio (ej. `sheets-writer@tu-proyecto.iam.gserviceaccount.com`).
   - Haz clic en el botón verde **Compartir** de la hoja de Google Sheets, pega el correo de la cuenta de servicio y dale permisos de **Editor**.
   - Copia el **ID de la hoja** de la URL del navegador:
     `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_SPREADSHEET_ID`**`/edit`

---

## ⚙️ Configuración Local

1. **Clonar e instalar dependencias:**
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd telefónica_app
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia el archivo `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Rellena los valores en `.env.local`:
   ```env
   APP_PASSWORD=clave_para_los_publicadores
   ADMIN_PASSWORD=clave_para_administracion
   SPREADSHEET_ID=tu_spreadsheet_id_de_google_sheets
   GOOGLE_CLIENT_EMAIL=tu-cuenta@tu-proyecto.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...tu_clave_con_saltos_de_linea...\n-----END PRIVATE KEY-----\n"
   ```

3. **Compilar y validar:**
   ```bash
   npm run build
   ```

---

## 🌐 Despliegue en Vercel (Paso a Paso)

1. Sube tu código a un repositorio en **GitHub** (puede ser público o privado).
2. Entra a [Vercel](https://vercel.com/) e inicia sesión.
3. Haz clic en **Add New > Project** e importa el repositorio.
4. En la sección **Environment Variables**, añade las 5 variables:
   - `APP_PASSWORD`: Tu clave de publicadores.
   - `ADMIN_PASSWORD`: Tu clave de administración.
   - `SPREADSHEET_ID`: El ID de tu hoja de Google Sheets.
   - `GOOGLE_CLIENT_EMAIL`: El email de tu Service Account.
   - `GOOGLE_PRIVATE_KEY`: El contenido completo de la clave privada (con comillas y saltos `\n`).
5. Haz clic en **Deploy**. ¡Tu aplicación estará en línea en segundos con HTTPS y costo $0!

---

## 🛡️ Seguridad y Privacidad

Este repositorio está diseñado para ser **100% seguro al publicarse como código abierto**:
- **Cero Credenciales en Código:** Ni contraseñas, ni tokens, ni IDs privados están incluidos en el repositorio.
- **Protección estricta en `.gitignore`:** Bloquea todos los archivos `.env*` y cualquier archivo `.json` de credenciales locales.
- **Aislamiento de Permisos:** La Service Account solo tiene acceso a la hoja de cálculo específica que le compartas como Editor; no tiene acceso al resto de tu cuenta de Google.
- **Endpoints Protegidos:** Todas las rutas bajo `/api/*` requieren validación estricta de credenciales en el servidor antes de realizar cualquier lectura o escritura.
