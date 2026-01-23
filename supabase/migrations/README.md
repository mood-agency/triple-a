# Supabase Migrations

Este directorio contiene las migraciones de base de datos para Supabase.

## Aplicar Migraciones

### Opción 1: Usando Supabase CLI

```bash
# Inicializar Supabase en el proyecto (si aún no está inicializado)
supabase init

# Aplicar todas las migraciones
supabase db push

# O aplicar migraciones específicas en orden
supabase db push --file supabase/migrations/20260122_add_user_preferences.sql
supabase db push --file supabase/migrations/20260122_add_user_preferences_trigger.sql
```

### Opción 2: Manualmente en el Dashboard de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a "SQL Editor" en el menú lateral
3. Copia y pega el contenido de cada archivo de migración **en orden**:
   - Primero: `20260122_add_user_preferences.sql`
   - Segundo: `20260122_add_user_preferences_trigger.sql`
4. Ejecuta cada consulta

## Migraciones Disponibles

### 1. 20260122_add_user_preferences.sql

Crea la tabla `user_preferences` para almacenar las preferencias del usuario:

- `show_sidebar`: Controla si el panel lateral está visible o no (default: `false`)
- `auto_sync`: Controla si la sincronización automática está activada (default: `true`)
- `fixed_note_id`: Guarda el ID de la tarea fijada en el sidebar (default: `null`)

Esta tabla incluye:
- Row Level Security (RLS) policies para proteger los datos de cada usuario
- Trigger automático para actualizar `updated_at`
- Relación con `auth.users` mediante foreign key

### 2. 20260122_add_user_preferences_trigger.sql

Crea un trigger automático que:
- Crea preferencias por defecto cuando un nuevo usuario se registra
- Se ejecuta automáticamente en el evento `AFTER INSERT` en `auth.users`
- Garantiza que todos los usuarios tengan sus preferencias inicializadas

### 3. 20260122_add_fixed_note_id_column.sql *(Opcional)*

**Solo para instalaciones existentes:** Si ya aplicaste las migraciones anteriores antes de esta actualización, ejecuta esta migración para agregar la columna `fixed_note_id` a tu tabla existente.

**Si es una instalación nueva:** No necesitas esta migración, la columna ya está incluida en la primera migración.

## Verificar que las Migraciones se Aplicaron Correctamente

### 1. Verificar la tabla

```sql
-- Ver estructura de la tabla
\d user_preferences

-- Ver datos existentes
SELECT * FROM user_preferences LIMIT 5;
```

### 2. Verificar el trigger

```sql
-- Ver triggers activos
SELECT
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

### 3. Probar el trigger (crear un usuario de prueba)

```sql
-- Crear un usuario de prueba para verificar que el trigger funciona
-- NOTA: Esto solo funciona si tienes permisos adecuados
-- Es mejor probarlo registrando un nuevo usuario desde la app
```

## Sincronización en Tiempo Real

La aplicación está configurada para:

1. **Cargar preferencias** desde Supabase al iniciar sesión
2. **Guardar cambios** automáticamente con debounce de 500ms
3. **Sincronizar en tiempo real** entre múltiples dispositivos usando Supabase Realtime

### Flujo de Sincronización

```
Usuario cambia configuración
    ↓
Actualización local (useState)
    ↓
Guardado en localStorage (backup)
    ↓
Debounce 500ms
    ↓
Guardado en Supabase
    ↓
Broadcast a otros dispositivos (Realtime)
    ↓
Otros dispositivos reciben actualización
```

## Troubleshooting

### Error: "relation 'user_preferences' does not exist"
- Asegúrate de haber ejecutado la primera migración

### Error: "trigger 'on_auth_user_created' does not exist"
- Asegúrate de haber ejecutado la segunda migración

### Las preferencias no se sincronizan entre dispositivos
1. Verifica que Realtime esté habilitado en tu proyecto de Supabase
2. Revisa la consola del navegador para ver logs de sincronización
3. Verifica que las políticas RLS estén configuradas correctamente
