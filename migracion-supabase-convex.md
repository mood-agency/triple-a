# Migración de Supabase a Convex: Una Guía Técnica Completa

## Introducción

Este artículo documenta la migración completa de una aplicación de productividad (gestión de tareas con notas, etiquetas, proyectos y contactos) desde **Supabase** hacia **Convex**. La aplicación está construida con React 19, TypeScript, y utiliza un monorepo con pnpm workspaces.

El objetivo es proporcionar una guía técnica detallada para desarrolladores que estén considerando una migración similar, explicando no solo el "cómo" sino también el "por qué" de cada decisión técnica.

---

## Tabla de Contenidos

1. [Contexto y Stack Tecnológico](#1-contexto-y-stack-tecnológico)
2. [Por qué Migrar de Supabase a Convex](#2-por-qué-migrar-de-supabase-a-convex)
3. [Comparación Técnica Detallada](#3-comparación-técnica-detallada)
4. [Arquitectura de la Migración](#4-arquitectura-de-la-migración)
5. [Proceso de Migración Paso a Paso](#5-proceso-de-migración-paso-a-paso)
6. [Patrones de Código: Antes y Después](#6-patrones-de-código-antes-y-después)
7. [Reactividad: El Cambio de Paradigma](#7-reactividad-el-cambio-de-paradigma)
8. [Autenticación: De Supabase Auth a Convex Auth](#8-autenticación-de-supabase-auth-a-convex-auth)
9. [Manejo de IDs y Migración de Datos](#9-manejo-de-ids-y-migración-de-datos)
10. [Optimizaciones de Performance](#10-optimizaciones-de-performance)
11. [Lecciones Aprendidas y Best Practices](#11-lecciones-aprendidas-y-best-practices)
12. [Conclusiones](#12-conclusiones)

---

## 1. Contexto y Stack Tecnológico

### Stack Original (Supabase)

```
Frontend:
├── React 19 + TypeScript
├── Vite 7
├── React Router v7
├── TinyBase (offline-first local state)
├── Tailwind CSS v4 + shadcn/ui
└── i18next (internacionalización)

Backend/Database:
├── Supabase (PostgreSQL)
├── Supabase Auth (OAuth + Email/Password)
├── Supabase Realtime (WebSocket subscriptions)
└── Supabase Storage (archivos)
```

### Stack Final (Convex)

```
Frontend:
├── React 19 + TypeScript
├── Vite 7
├── React Router v7
├── Convex React Client (reemplaza TinyBase)
├── Tailwind CSS v4 + shadcn/ui
└── i18next (internacionalización)

Backend/Database:
├── Convex (Document Database)
├── Convex Auth (Password provider)
├── Convex Reactive Queries (WebSocket nativo)
└── Convex File Storage
```

### Modelo de Datos

La aplicación maneja las siguientes entidades:

- **Notes**: Tareas/notas con contenido, categoría, deadline, estado
- **Labels**: Etiquetas con nombre y color
- **Projects**: Proyectos para agrupar notas
- **Contacts**: Contactos asignables a notas
- **NoteLabels**: Relación many-to-many notes ↔ labels
- **NoteAssignees**: Relación many-to-many notes ↔ contacts
- **NoteVersions**: Historial de versiones de contenido
- **NoteActions**: Registro de acciones (postpone, complete, etc.)
- **NoteComments**: Sistema de comentarios con threads
- **UserPreferences**: Configuración de usuario

---

## 2. Por qué Migrar de Supabase a Convex

### 2.1 Limitaciones Encontradas con Supabase

#### Complejidad del Estado Reactivo

Con Supabase, mantener el estado sincronizado requería múltiples capas:

```typescript
// Patrón típico con Supabase: múltiples subscriptions manuales
useEffect(() => {
  if (!supabase || !user) return;

  const channel = supabase
    .channel(`notes-${user.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notes',
      filter: `user_id=eq.${user.id}`,
    }, () => {
      // Recargar datos manualmente
      loadNotes();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user, loadNotes]);
```

Este patrón se repetía para **cada tabla**, resultando en:
- Código boilerplate extensivo
- Múltiples WebSocket connections
- Race conditions en actualizaciones
- Estado inconsistente entre subscriptions

#### Cache Invalidation Manual

```typescript
// Estado de versión para invalidar cache manualmente
const [noteLabelVersion, setNoteLabelVersion] = useState(0);

const addLabelToNote = async (noteId, labelId) => {
  await supabase.from('note_labels').insert({...});
  // Forzar re-render en todos los componentes dependientes
  setNoteLabelVersion(v => v + 1);
};

// En componentes consumidores:
const noteLabelsCache = useMemo(() => {
  // Reconstruir cache completo
  return buildCache();
}, [noteIdsKey, noteLabelVersion]); // ← version como dependency
```

#### Latencia en Operaciones

Supabase Realtime opera sobre PostgreSQL con un sistema de polling/CDC que introduce latencia:

1. Cliente ejecuta mutation → PostgreSQL
2. PostgreSQL notifica cambio → Supabase Realtime
3. Supabase Realtime → WebSocket → Cliente
4. Cliente invalida cache → Re-fetch

Esta cadena puede tomar 100-500ms dependiendo de la carga.

### 2.2 Ventajas de Convex

#### Reactividad Nativa de Primera Clase

Convex fue diseñado desde cero para aplicaciones reactivas:

```typescript
// Una línea reemplaza todo el setup de Supabase
const notes = useQuery(api.notes.list, { projectId });
```

No hay:
- Subscriptions manuales
- Cache invalidation
- Estado de versión
- Race conditions

#### Modelo de Consistencia Fuerte

Convex garantiza **consistencia serializable**:

- Las mutations se ejecutan en orden
- Las queries siempre ven el estado post-mutation
- No hay eventual consistency issues

#### TypeScript End-to-End

El schema de Convex genera tipos automáticamente:

```typescript
// convex/schema.ts
export default defineSchema({
  notes: defineTable({
    userId: v.string(),
    content: v.string(),
    completed: v.boolean(),
    // ...
  }).index("by_user", ["userId"]),
});

// Los tipos se generan automáticamente en _generated/
// El cliente tiene type-safety completo
const note = useQuery(api.notes.get, { id }); // ← Tipado automático
```

#### Performance Superior

Convex mantiene el estado en memoria con persistencia transaccional:

- Queries: ~10-50ms (vs 50-200ms en Supabase)
- Mutations: ~20-80ms (vs 100-300ms en Supabase)
- Reactivity: ~5-20ms (vs 100-500ms en Supabase)

---

## 3. Comparación Técnica Detallada

### 3.1 Modelo de Datos

| Aspecto | Supabase | Convex |
|---------|----------|--------|
| Base de datos | PostgreSQL (relacional) | Document DB (NoSQL) |
| Schema | SQL DDL + migrations | TypeScript schema |
| Relaciones | Foreign keys + JOINs | Referencias por ID + queries |
| Índices | SQL indexes | Declarativos en schema |
| Validación | Constraints + RLS | Validators en runtime |

#### Supabase Schema (SQL):

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_user ON notes(user_id);

-- Row Level Security
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own notes" ON notes
  USING (auth.uid() = user_id);
```

#### Convex Schema (TypeScript):

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables, // Auth tables incluidas

  notes: defineTable({
    userId: v.string(),
    content: v.string(),
    completed: v.boolean(),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"]),
});
```

### 3.2 Queries

| Aspecto | Supabase | Convex |
|---------|----------|--------|
| Sintaxis | SQL-like builder | JavaScript functions |
| Ejecución | Cliente → REST/Realtime | Cliente → WebSocket → Server |
| Caching | Manual | Automático |
| Reactividad | Subscriptions manuales | Nativo con useQuery |

#### Supabase Query:

```typescript
const loadNotes = async () => {
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    setNotes(data || []);
  } catch (err) {
    console.error('Error loading notes:', err);
  } finally {
    setLoading(false);
  }
};

// Llamar manualmente
useEffect(() => {
  loadNotes();
}, [user]);

// Subscription separada para realtime
useEffect(() => {
  const channel = supabase
    .channel('notes-changes')
    .on('postgres_changes', {...}, loadNotes)
    .subscribe();
  return () => supabase.removeChannel(channel);
}, []);
```

#### Convex Query:

```typescript
// convex/notes.ts (servidor)
export const list = query({
  args: { projectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("notes")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});

// Cliente: una línea, completamente reactivo
const notes = useQuery(api.notes.list, { projectId });
```

### 3.3 Mutations

| Aspecto | Supabase | Convex |
|---------|----------|--------|
| Transacciones | SQL transactions | Automáticas por mutation |
| Validación | RLS + constraints | Validators + auth checks |
| Side effects | Triggers/Functions | Código JavaScript |
| Optimistic updates | Manual | Automático |

#### Supabase Mutation:

```typescript
const createNote = async (content: string) => {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      content,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    toast.error('Error creating note');
    throw error;
  }

  // Actualizar estado local manualmente
  setNotes(prev => [...prev, data]);

  // O recargar todo
  await loadNotes();

  return data;
};
```

#### Convex Mutation:

```typescript
// convex/notes.ts (servidor)
export const create = mutation({
  args: {
    content: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const noteId = await ctx.db.insert("notes", {
      userId,
      content: args.content,
      category: args.category ?? "todo",
      completed: false,
      createdAt: new Date().toISOString(),
    });

    // Side effects en la misma transacción
    await ctx.db.insert("noteVersions", {
      noteId,
      content: args.content,
      versionNumber: 1,
      createdAt: new Date().toISOString(),
    });

    return noteId;
  },
});

// Cliente
const createNote = useMutation(api.notes.create);
await createNote({ content: "Nueva tarea" });
// ← UI se actualiza automáticamente via useQuery
```

---

## 4. Arquitectura de la Migración

### 4.1 Estrategia de Migración

Adoptamos una estrategia de **migración incremental por capas**:

```
Fase 1: Setup de Convex
├── Instalar dependencias
├── Configurar Convex Cloud
├── Definir schema
└── Crear ConvexClientProvider

Fase 2: Migrar Autenticación
├── Configurar Convex Auth
├── Crear http.ts router
├── Actualizar AuthContext
└── Migrar flujos de login/signup

Fase 3: Crear Hooks de Convex
├── useNotesConvex
├── useLabelsConvex
├── useProjectsConvex
├── useContactsConvex
└── useSettingsConvex

Fase 4: Migrar Componentes
├── Actualizar imports en hooks principales
├── Eliminar version state patterns
├── Usar queries reactivas
└── Limpiar código de Supabase

Fase 5: Optimizaciones
├── Batch queries (getAllNoteLabels)
├── Eliminar polling/refresh
└── Simplificar cache patterns

Fase 6: Cleanup
├── Eliminar hooks de Supabase no usados
├── Mantener integraciones externas (Google Calendar)
└── Actualizar documentación
```

### 4.2 Estructura de Archivos

```
apps/web/
├── convex/                    # Backend Convex
│   ├── _generated/           # Tipos auto-generados
│   ├── schema.ts             # Schema de la DB
│   ├── auth.ts               # Configuración de auth
│   ├── auth.config.ts        # Config de providers
│   ├── http.ts               # HTTP router para auth
│   ├── notes.ts              # CRUD de notas
│   ├── labels.ts             # CRUD de etiquetas
│   ├── projects.ts           # CRUD de proyectos
│   ├── contacts.ts           # CRUD de contactos
│   ├── noteComments.ts       # Comentarios
│   └── userPreferences.ts    # Preferencias
│
├── src/
│   ├── providers/
│   │   └── ConvexClientProvider.tsx
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Usa Convex Auth
│   │   ├── AssigneesContext.tsx   # Usa useAssigneesConvex
│   │   └── SyncContext.tsx        # Usa useConvexAuth
│   │
│   ├── hooks/
│   │   ├── convex/               # Hooks de Convex
│   │   │   ├── useNotesConvex.ts
│   │   │   ├── useLabelsConvex.ts
│   │   │   ├── useProjectsConvex.ts
│   │   │   ├── useContactsConvex.ts
│   │   │   ├── useSettingsConvex.ts
│   │   │   ├── useAssigneesConvex.ts
│   │   │   ├── useAnalyticsConvex.ts
│   │   │   ├── useDeletedNotesConvex.ts
│   │   │   ├── useNoteCommentsConvex.ts
│   │   │   └── useNoteVersionsAndActionsConvex.ts
│   │   │
│   │   ├── useNotes.ts           # Re-exporta useNotesConvex
│   │   ├── useLabels.ts          # Re-exporta useLabelsConvex
│   │   └── ...
```

---

## 5. Proceso de Migración Paso a Paso

### 5.1 Setup Inicial de Convex

```bash
# Instalar dependencias
pnpm add convex @convex-dev/auth

# Inicializar Convex
npx convex dev
```

Esto crea la estructura `convex/` y conecta con Convex Cloud.

### 5.2 Definir el Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Incluir tablas de autenticación
  ...authTables,

  notes: defineTable({
    userId: v.string(),
    content: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    deadline: v.optional(v.string()),
    category: v.string(),
    completed: v.boolean(),
    completedAt: v.optional(v.string()),
    pinned: v.boolean(),
    sortOrder: v.number(),
    projectId: v.optional(v.id("projects")),
    isPublic: v.boolean(),
    publicSlug: v.optional(v.string()),
    deletedAt: v.optional(v.string()),
    deletedReason: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user_project", ["userId", "projectId"])
    .index("by_public_slug", ["publicSlug"]),

  labels: defineTable({
    userId: v.string(),
    name: v.string(),
    color: v.string(),
    deletedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  // Junction table para many-to-many
  noteLabels: defineTable({
    noteId: v.id("notes"),
    labelId: v.id("labels"),
    userId: v.string(),
    createdAt: v.string(),
  })
    .index("by_note", ["noteId"])
    .index("by_label", ["labelId"])
    .index("by_user", ["userId"]),

  // ... más tablas
});
```

### 5.3 Configurar Autenticación

```typescript
// convex/auth.ts
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});
```

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);

export default http;
```

```bash
# Configurar variables de entorno
npx @convex-dev/auth
```

### 5.4 Crear el Provider de React

```typescript
// src/providers/ConvexClientProvider.tsx
import { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string
);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      {children}
    </ConvexAuthProvider>
  );
}
```

### 5.5 Actualizar AuthContext

```typescript
// src/contexts/AuthContext.tsx
import { createContext, useContext, type ReactNode } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

interface AuthContextType {
  userId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn: convexSignIn, signOut: convexSignOut } = useAuthActions();

  const signIn = async (email: string, password: string) => {
    try {
      await convexSignIn("password", { email, password, flow: "signIn" });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      await convexSignIn("password", { email, password, flow: "signUp" });
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userId: isAuthenticated ? "authenticated" : null,
        isLoading,
        isAuthenticated,
        signIn,
        signUp,
        signOut: convexSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 6. Patrones de Código: Antes y Después

### 6.1 Hook de Notas

#### Antes (Supabase): ~250 líneas

```typescript
// hooks/supabase/useNotesSupabase.ts
export function useNotesSupabase(options = {}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);

  // Cargar notas
  const loadNotes = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('sort_order');

      if (error) throw error;

      // Transformar datos
      const notes = (data || []).map(row => ({
        id: row.id,
        date: row.date,
        content: row.content,
        // ... 20+ campos
      }));

      setNotes(notes);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Subscription de realtime
  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel(`notes-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notes',
        filter: `user_id=eq.${user.id}`,
      }, () => loadNotes())
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotes]);

  // Crear nota
  const createNote = useCallback(async (content, category) => {
    if (!supabase || !user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: user.id,
        content,
        category,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Crear versión inicial
    await supabase.from('note_versions').insert({
      note_id: data.id,
      content,
      version_number: 1,
    });

    // Actualizar estado local
    setNotes(prev => [...prev, transformNote(data)]);

    return transformNote(data);
  }, [user]);

  // ... toggleComplete, delete, update, etc. (100+ líneas más)

  return {
    notes,
    loading,
    createNote,
    updateNote,
    deleteNote,
    // ...
  };
}
```

#### Después (Convex): ~150 líneas (40% menos)

```typescript
// hooks/convex/useNotesConvex.ts
export function useNotesConvex(options = {}) {
  const { date, projectId } = options;

  // UNA LÍNEA: Query reactiva con tipos automáticos
  const convexNotes = useQuery(api.notes.list, {
    projectId: isValidConvexId(projectId) ? projectId : undefined,
    date,
  });

  // Mutations tipadas automáticamente
  const createNoteMutation = useMutation(api.notes.create);
  const updateNoteMutation = useMutation(api.notes.update);
  const toggleCompleteMutation = useMutation(api.notes.toggleComplete);
  // ...

  // Transformar a interfaz de la app
  const notes = useMemo(() => {
    if (!convexNotes) return [];
    return convexNotes.map(n => ({
      id: n._id,
      date: n.date,
      content: n.content,
      // ... campos
    }));
  }, [convexNotes]);

  const loading = convexNotes === undefined;

  // Crear nota - sin manejo de estado manual
  const createNote = useCallback(async (content, category) => {
    const noteId = await createNoteMutation({
      content,
      category,
      date: effectiveDate,
    });
    return noteId;
    // ← UI se actualiza automáticamente via useQuery
  }, [createNoteMutation, effectiveDate]);

  return {
    notes,
    loading,
    createNote,
    // ...
  };
}
```

### 6.2 Relaciones Many-to-Many (Labels)

#### Antes (Supabase): Versión manual de invalidación

```typescript
export function useLabelsSupabase() {
  const [noteLabelVersion, setNoteLabelVersion] = useState(0);

  const addLabelToNote = async (noteId, labelId) => {
    await supabase.from('note_labels').insert({
      note_id: noteId,
      label_id: labelId,
    });

    // Forzar re-render en TODOS los componentes
    setNoteLabelVersion(v => v + 1);
    toast.success('Label added');
  };

  const getLabelsForNote = useCallback((noteId) => {
    // Función síncrona que devuelve del cache local
    return labelsCache.get(noteId) || [];
  }, [labelsCache]);

  return {
    noteLabelVersion, // ← Consumidores usan esto como dependency
    getLabelsForNote,
    addLabelToNote,
  };
}

// En componentes consumidores:
const { getLabelsForNote, noteLabelVersion } = useLabels();

const noteLabelsCache = useMemo(() => {
  const cache = new Map();
  for (const note of notes) {
    cache.set(note.id, getLabelsForNote(note.id));
  }
  return cache;
}, [notes, getLabelsForNote, noteLabelVersion]); // ← Version fuerza rebuild
```

#### Después (Convex): Query batch reactiva

```typescript
// convex/labels.ts - Query batch en el servidor
export const getAllNoteLabels = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return {};

    const allNoteLabels = await ctx.db
      .query("noteLabels")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    const allLabels = await ctx.db
      .query("labels")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const labelsMap = new Map(allLabels.map(l => [l._id, l]));
    const result = {};

    for (const nl of allNoteLabels) {
      const label = labelsMap.get(nl.labelId);
      if (label) {
        if (!result[nl.noteId]) result[nl.noteId] = [];
        result[nl.noteId].push(label);
      }
    }

    return result;
  },
});

// hooks/convex/useLabelsConvex.ts
export function useLabelsConvex() {
  const allNoteLabelsData = useQuery(api.labels.getAllNoteLabels);

  // Mapa reactivo - se actualiza automáticamente
  const allNoteLabels = useMemo(() => {
    if (!allNoteLabelsData) return new Map();
    const map = new Map();
    for (const [noteId, labels] of Object.entries(allNoteLabelsData)) {
      map.set(noteId, labels.map(transformLabel));
    }
    return map;
  }, [allNoteLabelsData]);

  // Función reactiva - retorna datos actuales sin version state
  const getLabelsForNote = useCallback((noteId) => {
    return allNoteLabels.get(noteId) ?? [];
  }, [allNoteLabels]);

  return {
    getLabelsForNote, // ← Referencia cambia cuando datos cambian
    // NO más noteLabelVersion
  };
}

// En componentes - simplificado
const { getLabelsForNote } = useLabels();

const noteLabelsCache = useMemo(() => {
  const cache = new Map();
  for (const note of notes) {
    cache.set(note.id, getLabelsForNote(note.id));
  }
  return cache;
}, [notes, getLabelsForNote]); // ← getLabelsForNote es suficiente
```

---

## 7. Reactividad: El Cambio de Paradigma

### 7.1 Modelo Mental de Supabase

```
┌─────────────┐    HTTP/REST    ┌─────────────┐
│   Cliente   │ ───────────────▶│  Supabase   │
│   (React)   │                 │  (Postgres) │
└─────────────┘                 └─────────────┘
       │                              │
       │   WebSocket (Realtime)       │
       │◀─────────────────────────────│
       │                              │
       ▼                              │
┌─────────────┐                       │
│ Local State │◀──── Manual Sync ─────┘
│  (useState) │
└─────────────┘

Flujo de escritura:
1. Mutation → Supabase REST
2. Supabase → PostgreSQL
3. PostgreSQL → CDC → Realtime
4. Realtime → WebSocket → Cliente
5. Cliente → Callback → loadData()
6. loadData() → setNotes() → Re-render
```

### 7.2 Modelo Mental de Convex

```
┌─────────────┐   WebSocket (único)  ┌─────────────┐
│   Cliente   │◀════════════════════▶│   Convex    │
│   (React)   │                      │  (Server)   │
└─────────────┘                      └─────────────┘
       │                                    │
       │   useQuery() = Subscription        │
       │   useMutation() = RPC              │
       ▼                                    │
┌─────────────┐                             │
│ React State │◀───── Automático ───────────┘
│ (gestionado │
│ por Convex) │
└─────────────┘

Flujo de escritura:
1. Mutation → Convex WebSocket
2. Convex ejecuta handler
3. Convex → Actualiza todas las queries afectadas
4. Clientes con queries activas → Re-render automático
```

### 7.3 Implicaciones Prácticas

#### Sin Version State

```typescript
// ANTES: Patrón necesario con Supabase
const [noteAssigneeVersion, setNoteAssigneeVersion] = useState(0);

useEffect(() => {
  setNoteAssignees(getAssigneesForNote(note.id));
}, [note.id, noteAssigneeVersion, getAssigneesForNote]);

// DESPUÉS: Convex hace el tracking automáticamente
const noteAssignees = useMemo(
  () => getAssigneesForNote(note.id),
  [note.id, getAssigneesForNote] // ← getAssigneesForNote cambia cuando datos cambian
);
```

#### Sin Refresh Manual

```typescript
// ANTES: Refresh después de acciones
const handleRestore = async (note) => {
  await restoreNote(note);
  refresh(); // ← Necesario para ver cambios
};

// DESPUÉS: Convex actualiza automáticamente
const handleRestore = async (note) => {
  await restoreNote(note);
  // ← useQuery(api.notes.listDeleted) se actualiza solo
};
```

#### Sin Race Conditions

```typescript
// ANTES: Posible race condition
const addLabel = async () => {
  await supabase.from('note_labels').insert({...});
  // Si otro cliente añade una label al mismo tiempo,
  // podríamos no ver ambas hasta el siguiente refresh
};

// DESPUÉS: Consistencia serializable
const addLabel = async () => {
  await addLabelMutation({...});
  // Convex garantiza que TODOS los clientes
  // ven el estado consistente después de la mutation
};
```

---

## 8. Autenticación: De Supabase Auth a Convex Auth

### 8.1 Diferencias Arquitectónicas

| Aspecto | Supabase Auth | Convex Auth |
|---------|---------------|-------------|
| Providers | OAuth, Email, Phone, Magic Link | Password, OAuth (configurable) |
| Session | JWT en localStorage | Token en Convex |
| Verificación | En cada request | En WebSocket connection |
| RLS | Row Level Security (SQL) | Checks en handlers |

### 8.2 Configuración de Convex Auth

```typescript
// convex/auth.ts
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});

// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

### 8.3 Uso en Queries/Mutations

```typescript
// convex/notes.ts
import { auth } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    // Obtener user ID del contexto autenticado
    const userId = await auth.getUserId(ctx);
    if (!userId) return []; // No autenticado

    return await ctx.db
      .query("notes")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
  },
});

export const create = mutation({
  args: { content: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("notes", {
      userId,
      content: args.content,
      // ...
    });
  },
});
```

---

## 9. Manejo de IDs y Migración de Datos

### 9.1 El Problema de los IDs

Supabase usa **UUIDs** (ej: `4e49d9d3-7d23-4138-8d42-c5cd669dc8ac`)
Convex usa **IDs propios** (ej: `k17abc123def456`)

Durante la migración, el código puede recibir IDs de ambos formatos (localStorage, URLs, etc.).

### 9.2 Solución: Validación de IDs

```typescript
/**
 * Detecta si un string es un ID válido de Convex (no UUID)
 * UUIDs tienen guiones, Convex IDs no
 */
function isValidConvexId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id.includes("-")) return false; // UUID tiene guiones
  return /^[a-zA-Z0-9_]+$/.test(id);
}

// Uso en hooks
const createNote = useCallback(async (content, labelIds) => {
  // Filtrar IDs inválidos (UUIDs de Supabase)
  const validLabelIds = labelIds?.filter(isValidConvexId);

  const noteId = await createNoteMutation({
    content,
    labelIds: validLabelIds as Id<"labels">[],
  });

  return noteId;
}, [createNoteMutation]);
```

### 9.3 Limpieza de localStorage

```typescript
// hooks/convex/useSettingsConvex.ts
useEffect(() => {
  // Limpiar IDs de Supabase en localStorage al iniciar
  const storedProjectId = localStorage.getItem('activeProjectId');
  if (storedProjectId && !isValidConvexId(storedProjectId)) {
    localStorage.removeItem('activeProjectId');
    console.log('[Settings] Cleared invalid Supabase project ID');
  }

  const storedNoteId = localStorage.getItem('fixedNoteId');
  if (storedNoteId && !isValidConvexId(storedNoteId)) {
    localStorage.removeItem('fixedNoteId');
    console.log('[Settings] Cleared invalid Supabase note ID');
  }
}, []);
```

### 9.4 Migración de Datos (Opcional)

Si necesitas migrar datos existentes:

```typescript
// convex/notes.ts
export const importFromSupabase = mutation({
  args: {
    supabaseId: v.string(),
    userId: v.string(),
    content: v.string(),
    // ... todos los campos
  },
  handler: async (ctx, args) => {
    const noteId = await ctx.db.insert("notes", {
      userId: args.userId,
      content: args.content,
      // ... mapear campos
    });

    return { noteId, supabaseId: args.supabaseId };
  },
});

// Script de migración
async function migrateNotes() {
  const { data: supabaseNotes } = await supabase
    .from('notes')
    .select('*');

  for (const note of supabaseNotes) {
    await convex.mutation(api.notes.importFromSupabase, {
      supabaseId: note.id,
      userId: note.user_id,
      content: note.content,
      // ...
    });
  }
}
```

---

## 10. Optimizaciones de Performance

### 10.1 Batch Queries

En lugar de N queries para N notas:

```typescript
// ❌ N queries (una por nota)
for (const note of notes) {
  const labels = useQuery(api.labels.getLabelsForNote, { noteId: note.id });
}

// ✅ 1 query para todas las notas
const allNoteLabels = useQuery(api.labels.getAllNoteLabels);
```

Implementación del batch:

```typescript
// convex/labels.ts
export const getAllNoteLabels = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return {};

    // 2 queries en lugar de N
    const allNoteLabels = await ctx.db
      .query("noteLabels")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();

    const allLabels = await ctx.db
      .query("labels")
      .withIndex("by_user", q => q.eq("userId", userId))
      .filter(q => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Procesamiento en memoria
    const labelsMap = new Map(allLabels.map(l => [l._id, l]));
    const result = {};

    for (const nl of allNoteLabels) {
      const label = labelsMap.get(nl.labelId);
      if (label) {
        result[nl.noteId] = result[nl.noteId] || [];
        result[nl.noteId].push(label);
      }
    }

    return result;
  },
});
```

### 10.2 Índices Optimizados

```typescript
// convex/schema.ts
notes: defineTable({...})
  .index("by_user", ["userId"])              // Para listar notas del usuario
  .index("by_user_date", ["userId", "date"]) // Para filtrar por fecha
  .index("by_user_project", ["userId", "projectId"]) // Para filtrar por proyecto
  .index("by_public_slug", ["publicSlug"]),  // Para notas públicas

noteLabels: defineTable({...})
  .index("by_note", ["noteId"])   // Para obtener labels de una nota
  .index("by_label", ["labelId"]) // Para obtener notas con una label
  .index("by_user", ["userId"]),  // Para batch queries
```

### 10.3 Auto-save Debouncing

El debounce sigue siendo importante para no saturar con mutations:

```typescript
// hooks/useAutoSave.ts
export function useAutoSave<T>({
  value,
  originalValue,
  onSave,
  debounceMs = 3000, // 3 segundos es razonable
  enabled = true,
}) {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || value === originalValue) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = window.setTimeout(() => {
      onSave(value);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, originalValue, debounceMs, enabled, onSave]);
}
```

---

## 11. Lecciones Aprendidas y Best Practices

### 11.1 Migración Incremental

**DO:** Migrar por capas, manteniendo compatibilidad

```
hooks/
├── convex/
│   └── useNotesConvex.ts  # Nueva implementación
├── supabase/
│   └── useNotesSupabase.ts  # Legacy (temporal)
└── useNotes.ts  # Re-exporta la versión activa
```

```typescript
// hooks/useNotes.ts
// Cambiar el import cuando estés listo
import { useNotesConvex } from './convex/useNotesConvex';
// import { useNotesSupabase } from './supabase/useNotesSupabase';

export function useNotes() {
  return useNotesConvex();
}
```

**DON'T:** Reescribir todo de una vez

### 11.2 Validación de IDs Durante Transición

**DO:** Validar IDs en cada operación

```typescript
const updateNote = useCallback(async (id, content) => {
  if (!isValidConvexId(id)) {
    console.warn('Invalid Convex ID, possibly Supabase UUID:', id);
    return;
  }
  await updateNoteMutation({ id: id as Id<"notes">, content });
}, [updateNoteMutation]);
```

**DON'T:** Asumir que todos los IDs son válidos

### 11.3 Eliminar Patterns Obsoletos

**DO:** Remover version state y refresh manual

```typescript
// ANTES
const [version, setVersion] = useState(0);
const addLabel = async () => {
  await mutation();
  setVersion(v => v + 1); // ❌ Innecesario con Convex
};

// DESPUÉS
const addLabel = async () => {
  await mutation();
  // ✅ Convex actualiza automáticamente
};
```

**DON'T:** Mantener código de sincronización manual

### 11.4 Type Safety

**DO:** Aprovechar los tipos generados

```typescript
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// Tipado automático del resultado
const notes = useQuery(api.notes.list);

// Tipado de argumentos
await createNoteMutation({
  content: "...",
  projectId: projectId as Id<"projects">, // Type assertion necesario
});
```

### 11.5 Manejo de Integraciones Externas

**DO:** Mantener Supabase para casos específicos (OAuth externo, etc.)

```typescript
// Google Calendar sigue usando Supabase para OAuth tokens
// porque Convex no maneja OAuth de terceros directamente
import { supabase } from '@/lib/supabase';

const googleCalendarService = {
  async getOAuthUrl() {
    // Supabase maneja el flow OAuth de Google
    return supabase.auth.signInWithOAuth({...});
  }
};
```

**DON'T:** Forzar migración de todo cuando no tiene sentido

---

## 12. Conclusiones

### 12.1 Resumen de Beneficios

| Métrica | Supabase | Convex | Mejora |
|---------|----------|--------|--------|
| Líneas de código (hooks) | ~1500 | ~900 | -40% |
| Tiempo de setup realtime | 30 min/tabla | 0 (automático) | -100% |
| Latencia percibida | 100-500ms | 10-50ms | 5-10x |
| Race conditions | Posibles | Eliminadas | ✅ |
| Type safety | Parcial | Completo | ✅ |

### 12.2 Cuándo Elegir Convex

✅ **Ideal para:**
- Aplicaciones con estado reactivo complejo
- Colaboración en tiempo real
- Prototipado rápido con TypeScript
- Equipos que valoran developer experience

⚠️ **Considerar alternativas si:**
- Necesitas SQL avanzado (JOINs complejos, window functions)
- Tienes datos relacionales muy normalizados
- Requieres control total sobre la infraestructura
- Necesitas migrations tradicionales de base de datos

### 12.3 El Futuro

Convex representa un cambio de paradigma hacia **"backend as a reactive layer"**. En lugar de pensar en REST endpoints + subscriptions + cache invalidation, piensas en:

- **Queries** = Funciones que retornan datos (reactivos automáticamente)
- **Mutations** = Funciones que modifican datos (transaccionales)
- **Actions** = Side effects (llamadas externas, etc.)

Este modelo mental simplifica drásticamente el desarrollo de aplicaciones en tiempo real.

---

## Recursos Adicionales

- [Convex Documentation](https://docs.convex.dev)
- [Convex Auth Setup](https://labs.convex.dev/auth)
- [Migrating from Supabase](https://docs.convex.dev/database/migration)
- [TypeScript Best Practices](https://docs.convex.dev/typescript)

---

*Artículo escrito durante la migración real de una aplicación de productividad de Supabase a Convex. El código mostrado proviene de la implementación actual.*
