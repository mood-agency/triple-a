# Sincronización de Preferencias de Usuario

## Descripción General

La aplicación ahora sincroniza las preferencias del usuario (como la visibilidad del panel lateral) entre:
- **localStorage** - Para acceso rápido y backup local
- **Supabase** - Para sincronización en la nube y acceso desde múltiples dispositivos

## Arquitectura

### Componentes

1. **useSettings** (`src/hooks/useSettings.ts`)
   - Hook principal para acceder y modificar configuraciones
   - Maneja el estado local con React useState
   - Guarda automáticamente en localStorage

2. **useUserPreferences** (`src/hooks/useUserPreferences.ts`)
   - Hook especializado para sincronización con Supabase
   - Se integra automáticamente con useSettings
   - Maneja:
     - Carga inicial desde Supabase
     - Guardado con debounce (500ms)
     - Suscripción a cambios en tiempo real

3. **Tabla Supabase: user_preferences**
   - Almacena preferencias por usuario
   - Políticas RLS para seguridad
   - Trigger automático para nuevos usuarios

### Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                    Usuario Abre la App                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  useSettings Hook      │
                │  - Carga localStorage  │
                └────────┬───────────────┘
                         │
                         ▼
                ┌────────────────────────┐
                │ useUserPreferences     │
                │ - ¿Usuario logueado?   │
                └────┬──────────┬────────┘
                     │ Sí       │ No
                     ▼          ▼
         ┌───────────────┐  [Usar solo
         │ Cargar desde  │   localStorage]
         │  Supabase     │
         └───────┬───────┘
                 │
                 ▼
    ┌────────────────────────┐
    │ Actualizar Estado      │
    │ Local + localStorage   │
    └────────────────────────┘
```

### Guardado de Cambios

```
Usuario cambia preferencia (ej: toggle sidebar)
    ↓
setShowSidebar(true)
    ↓
updateSettings({ showSidebar: true })
    ↓
┌─────────────────────────────────┐
│  INMEDIATO                      │
│  • Actualización de estado      │
│  • Guardado en localStorage     │
│  • Re-render de UI              │
└─────────────────────────────────┘
    ↓
┌─────────────────────────────────┐
│  DEBOUNCE 500ms                 │
│  • Guardado en Supabase         │
│  • Broadcast a otros devices    │
└─────────────────────────────────┘
```

## Preferencias Disponibles

### showSidebar
- **Tipo:** `boolean`
- **Default:** `false`
- **Descripción:** Controla si el panel lateral de detalles está visible
- **Ubicación:** Botón en la barra superior de la lista de notas

### autoSync
- **Tipo:** `boolean`
- **Default:** `true`
- **Descripción:** Controla si la sincronización automática está activada
- **Ubicación:** Menú de configuración

## Nomenclatura Clara

Para evitar confusión entre diferentes funcionalidades:

| Término | Significado | Ubicación |
|---------|-------------|-----------|
| `pinned` / `isPinned` | Tarea fijada en la parte superior de la lista | Botón de pin en cada tarea |
| `showSidebar` | Panel lateral de detalles visible | Botón toggle en barra superior |
| `fixedNoteId` | ID de la nota fija en el sidebar | Estado interno |

## Configuración de Supabase

### 1. Aplicar Migraciones

Ejecuta estos archivos SQL en orden:

1. `supabase/migrations/20260122_add_user_preferences.sql`
2. `supabase/migrations/20260122_add_user_preferences_trigger.sql`

Ver [supabase/migrations/README.md](../supabase/migrations/README.md) para instrucciones detalladas.

### 2. Verificar Configuración

En el SQL Editor de Supabase:

```sql
-- Verificar tabla
SELECT * FROM user_preferences;

-- Verificar trigger
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'user_preferences';
```

## Testing Manual

### Test 1: Sincronización Básica

1. **Iniciar sesión** en la aplicación
2. **Abrir consola** del navegador
3. **Toggle el sidebar** usando el botón
4. **Verificar logs:**
   ```
   [UserPreferences] Loaded from Supabase: { show_sidebar: false, auto_sync: true }
   [UserPreferences] Saved to Supabase: { showSidebar: true, autoSync: true }
   ```
5. **Refrescar la página** → El sidebar debe mantener su estado

### Test 2: Sincronización Multi-dispositivo

1. **Dispositivo A:** Iniciar sesión
2. **Dispositivo B:** Iniciar sesión con la misma cuenta
3. **Dispositivo A:** Cambiar preferencia (toggle sidebar)
4. **Dispositivo B:** La preferencia debe actualizarse automáticamente en ~1-2 segundos
5. **Verificar log en Dispositivo B:**
   ```
   [UserPreferences] Realtime update received: { new: { show_sidebar: true, ... } }
   ```

### Test 3: Primer Usuario (Trigger)

1. **Crear cuenta nueva** en la aplicación
2. **Verificar en Supabase:**
   ```sql
   SELECT * FROM user_preferences WHERE user_id = '[nuevo-user-id]';
   ```
3. **Resultado esperado:**
   - Registro creado automáticamente
   - `show_sidebar: false`
   - `auto_sync: true`

### Test 4: Modo Offline

1. **Iniciar sesión** y cambiar preferencias
2. **Desconectar internet**
3. **Cambiar preferencias** → Deben funcionar localmente
4. **Reconectar internet**
5. **Verificar:** Las preferencias deben sincronizarse automáticamente

## Troubleshooting

### Problema: Las preferencias no se guardan

**Solución:**
1. Verificar que las migraciones se aplicaron correctamente
2. Revisar la consola para errores
3. Verificar políticas RLS en Supabase

### Problema: No sincroniza entre dispositivos

**Solución:**
1. Verificar que Realtime esté habilitado en Supabase
2. Revisar logs de suscripción en la consola
3. Verificar que ambos dispositivos estén con la misma cuenta

### Problema: Error "user_preferences does not exist"

**Solución:**
1. Aplicar la migración `20260122_add_user_preferences.sql`
2. Verificar que la tabla se creó correctamente

## Código Relevante

### Uso en Componentes

```typescript
import { useSettings } from '@/hooks/useSettings';

function MyComponent() {
  const { settings, updateSettings } = useSettings();

  // Leer preferencia
  const isSidebarVisible = settings.showSidebar;

  // Cambiar preferencia
  const toggleSidebar = () => {
    updateSettings({ showSidebar: !settings.showSidebar });
  };

  return (
    <button onClick={toggleSidebar}>
      {isSidebarVisible ? 'Hide' : 'Show'} Sidebar
    </button>
  );
}
```

### Agregar Nueva Preferencia

1. **Actualizar interfaz:**
   ```typescript
   // src/hooks/useSettings.ts
   export interface AppSettings {
     autoSync: boolean
     showSidebar: boolean
     newPreference: string // Nueva preferencia
   }
   ```

2. **Actualizar defaults:**
   ```typescript
   const DEFAULT_SETTINGS: AppSettings = {
     autoSync: true,
     showSidebar: false,
     newPreference: 'default-value',
   }
   ```

3. **Migración SQL:**
   ```sql
   ALTER TABLE user_preferences
   ADD COLUMN new_preference TEXT DEFAULT 'default-value';
   ```

4. **Actualizar tipos Supabase:**
   ```typescript
   // src/types/supabase.ts
   user_preferences: {
     Row: {
       // ...
       new_preference: string
     }
   }
   ```

## Métricas y Monitoreo

Para monitorear la sincronización en producción:

```typescript
// Agregar tracking en useUserPreferences.ts
console.log('[UserPreferences] Load time:', Date.now() - startTime);
console.log('[UserPreferences] Sync latency:', Date.now() - changeTime);
```

## Referencias

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Triggers](https://supabase.com/docs/guides/database/functions)
