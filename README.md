# Gestión de Territorio Telefónico

Herramienta web ligera, sobria y de diseño *mobile-first* desarrollada para optimizar la organización y registro colaborativo de llamadas en territorios asignados, conectándose directamente con Google Sheets como base de datos centralizada y sin costo de mantenimiento.

---

## 🎯 Propósito y Características

- **Flujo individual y secuencial:** El voluntario recibe un único contacto a la vez, evitando solapamientos o llamadas duplicadas.
- **Bloqueo temporal inteligente:** Cada número tomado queda reservado durante 15 minutos en memoria para evitar que otro usuario lo marque simultáneamente. Si se concluye o libera, vuelve a estar disponible de inmediato.
- **Sincronización en tiempo real:** Los resultados (*Atendió*, *No atendió*, *Fuera de servicio*) se asientan directamente en las casillas correspondientes de la planilla central.
- **Soporte multiterreno:** Pestañas dedicadas para listas generales y edificios o accesos restringidos.
- **Acceso simple y unificado:** Ingreso mediante contraseña de uso general, sin necesidad de crear ni gestionar cuentas de correo individuales para cada voluntario.

---

## 🧱 Arquitectura Técnica

- **Frontend / Backend:** Next.js (App Router), TypeScript, Tailwind CSS.
- **Base de datos:** Google Sheets API v4 mediante Service Account de Google Cloud.
- **Infraestructura:** Despliegue serverless en Vercel (plan Hobby, costo $0).

---

## 📋 Configuración de la Base de Datos

La aplicación requiere una planilla de Google Sheets vinculada con permisos de edición para la cuenta de servicio. 

Por cuestiones de privacidad y formato de trabajo interno, la plantilla con la estructura exacta de columnas no se publica de forma abierta. Para solicitar el formato de columnas o adaptar la herramienta, puedes abrir un Issue en este repositorio o ponerte en contacto directamente.

---

## ⚙️ Configuración y Despliegue

### 1. Google Cloud (Service Account)
1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita la **Google Sheets API**.
3. En *Credenciales*, crea una **Service Account** y genera una clave privada en formato **JSON**.
4. Abre tu Google Sheet, haz clic en **Compartir** y agrega el correo de la cuenta de servicio (`client_email`) con rol de **Editor**.

### 2. Variables de Entorno
Copia el archivo `.env.example` como `.env.local` (o cárgalas en la sección *Settings > Environment Variables* en Vercel):

```env
APP_PASSWORD=clave_de_acceso_voluntarios
ADMIN_PASSWORD=clave_para_funciones_admin
SPREADSHEET_ID=id_alfanumerico_de_la_hoja
GOOGLE_CLIENT_EMAIL=cuenta-servicio@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"