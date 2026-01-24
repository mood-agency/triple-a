# Triple-A Email Worker

Cloudflare Worker que recibe emails y crea tareas automáticamente en la aplicación.

## Cómo funciona

1. Un usuario envía un email a `task@tudominio.com` (o cualquier dirección configurada)
2. Cloudflare Email Routing recibe el email y lo envía a este Worker
3. El Worker busca al usuario en Supabase por su dirección de email
4. Si el usuario existe, crea una nueva tarea con el asunto como título y el cuerpo como descripción

## Requisitos

- Cuenta de Cloudflare con un dominio configurado
- Email Routing habilitado en el dominio
- Proyecto de Supabase con las tablas `profiles` y `notes`

## Instalación

### 1. Instalar dependencias

```bash
cd workers/email-worker
npm install
```

### 2. Autenticarse en Cloudflare

```bash
npx wrangler login
```

### 3. Configurar variables de entorno

Configura los secretos (NO los pongas en wrangler.toml):

```bash
npx wrangler secret put SUPABASE_URL
# Ingresa: https://tu-proyecto.supabase.co

npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Ingresa: tu service role key de Supabase
```

### 4. Desplegar el Worker

```bash
npm run deploy
```

### 5. Configurar Email Routing en Cloudflare

1. Ve al [Dashboard de Cloudflare](https://dash.cloudflare.com)
2. Selecciona tu dominio
3. Ve a **Email** > **Email Routing**
4. Habilita Email Routing si no está habilitado
5. En la pestaña **Routing rules**, crea una nueva regla:
   - **Custom address**: `task` (para task@tudominio.com)
   - O **Catch-all**: para recibir todos los emails
   - **Action**: Send to Worker
   - **Destination**: `triple-a-email-worker`
6. Guarda la regla

## Uso

Una vez configurado, los usuarios pueden:

1. Enviar un email a `task@tudominio.com`
2. El **asunto** del email se convierte en el **título** de la tarea
3. El **cuerpo** del email se convierte en la **descripción**
4. La tarea aparece automáticamente en su lista de hoy

### Ejemplo

```
De: usuario@gmail.com
Para: task@tudominio.com
Asunto: Llamar al cliente ABC

Recordar preguntar sobre el presupuesto del proyecto.
Número: 555-1234
```

Esto crea una tarea:
- **Título**: "Llamar al cliente ABC"
- **Descripción**: "From: usuario@gmail.com\nDate: ...\n---\nRecordar preguntar..."
- **Categoría**: todo
- **Fecha**: hoy

## Desarrollo local

Para probar localmente (limitado, ya que los emails no se pueden simular fácilmente):

```bash
npm run dev
```

Para ver logs en producción:

```bash
npm run tail
```

## Estructura del proyecto

```
workers/email-worker/
├── src/
│   └── index.ts       # Lógica principal del worker
├── wrangler.toml      # Configuración de Cloudflare Worker
├── package.json       # Dependencias
├── tsconfig.json      # Configuración TypeScript
└── README.md          # Esta documentación
```

## Notas importantes

- El email del remitente debe estar registrado en la tabla `profiles` de Supabase
- Si el usuario no existe, el email se procesa pero no se crea ninguna tarea
- Los emails no rebotan por errores de procesamiento para evitar problemas
- El contenido HTML se convierte a texto plano automáticamente
- La descripción se limita a 2000 caracteres
