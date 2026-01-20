# Navegación de Tareas - Estilo Notepad

## Descripción General

La lista de tareas se comporta como un documento de texto continuo, permitiendo navegar con el teclado de forma natural, similar a un editor de texto como Notepad.

## Especificaciones de Navegación

### 1. Click en Título de Tarea
**Comportamiento:** Al hacer click en el título de una tarea, el caret se posiciona automáticamente en el texto, en la posición exacta donde se hizo click.

**Implementación:**
- Se calcula la posición del click relativa al texto
- Se usa `canvas.measureText()` para determinar el carácter exacto
- El input recibe foco con `setSelectionRange(pos, pos)`

**Archivo:** `src/components/notes/NoteList.tsx` (función `handleContentClick` en NoteRow)

---

### 2. Navegación con Flecha Abajo (↓)

**Comportamiento:** Al presionar la flecha abajo, el cursor salta al título de la tarea de abajo manteniendo la posición horizontal (columna). El caret debe quedar activo para escritura inmediata.

**Casos:**
| Situación | Acción |
|-----------|--------|
| Hay tarea siguiente | Navega al título de la siguiente tarea con caret activo |
| Es la última tarea | No hace nada |

**Requisitos:**
- El input de la tarea destino debe estar en modo edición
- El caret debe estar visible y activo
- El usuario puede escribir inmediatamente sin hacer click

**Preservación de columna:**
- Si la nueva línea es más corta que la posición actual, el cursor va al final
- Si es igual o más larga, mantiene la misma columna

**Archivos:**
- `src/components/notes/NoteList.tsx` - `handleNavigateDownFromTitle`
- `src/components/notes/NoteRow.tsx` (interno) - `handleContentKeyDown`

---

### 3. Navegación con Flecha Arriba (↑)

**Comportamiento:** Al presionar la flecha arriba, el cursor salta al título de la tarea de arriba manteniendo la posición horizontal (columna). El caret debe quedar activo para escritura inmediata.

**Casos:**
| Situación | Acción |
|-----------|--------|
| Es la primera tarea | No hace nada |
| Hay tarea anterior | Navega al título de la tarea anterior con caret activo |

**Requisitos:**
- El input de la tarea destino debe estar en modo edición
- El caret debe estar visible y activo
- El usuario puede escribir inmediatamente sin hacer click

**Archivos:**
- `src/components/notes/NoteList.tsx` - `handleNavigateUpFromTitle`
- `src/components/notes/NoteRow.tsx` (interno) - `handleContentKeyDown`

---

### 4. Creación de Nueva Tarea (Enter)

**Comportamiento:** Al presionar Enter en el título de una tarea, se crea una nueva tarea vacía inmediatamente debajo y el caret queda activo en la nueva tarea para escritura inmediata.

**Flujo:**
1. Guarda el contenido actual de la tarea
2. Crea una nueva tarea con `content` vacío
3. Calcula el `sort_order` para posicionarla correctamente
4. Selecciona automáticamente la nueva tarea
5. El input de la nueva tarea recibe foco con el caret al inicio (posición 0)
6. El usuario puede comenzar a escribir inmediatamente sin necesidad de hacer click

**Archivos:**
- `src/components/notes/NoteList.tsx` - `handleCreateNoteAfter`
- `src/hooks/useNotes.ts` - `createNoteAfter`

---

### 5. Sistema de Preservación de Columna (desiredColumn)

**Concepto:** Al navegar verticalmente entre tareas, el sistema recuerda la posición horizontal del cursor para mantener una experiencia de edición natural.

**Estado:**
```typescript
const [desiredColumn, setDesiredColumn] = useState(0);
```

**Comportamiento:**
1. Al presionar ↑ o ↓, se captura la posición actual: `selectionStart`
2. Se guarda en `desiredColumn`
3. Al enfocar la nueva tarea, se aplica: `setSelectionRange(pos, pos)`
4. Si el texto es más corto, se usa `Math.min(desiredColumn, text.length)`

---

## Archivos Clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/components/notes/NoteList.tsx` | Orquestador principal de navegación |
| `src/components/notes/NoteRow.tsx` | Manejo de eventos de teclado en títulos |
| `src/components/ui/EditableDescription.tsx` | Edición de descripciones |
| `src/hooks/useNotes.ts` | CRUD y persistencia en base de datos |

---

## Diagrama de Navegación

```
┌─────────────────────────────────────┐
│ Tarea 1: Comprar leche              │  ← ↑ (primera tarea: no hace nada)
│   Descripción de tarea 1...         │
├─────────────────────────────────────┤
│ Tarea 2: Llamar al doctor|          │  ← cursor aquí, columna 20
│   (sin descripción)                 │
├─────────────────────────────────────┤
│ Tarea 3: Revisar correo             │  ← ↓ salta aquí, mantiene col 20
│   Descripción de tarea 3...         │     "Revisar correo" tiene 14 chars
├─────────────────────────────────────┤     → cursor va al final (pos 14)
│ Tarea 4: Última tarea               │  ← ↓ (última tarea: no hace nada)
└─────────────────────────────────────┘

Enter en cualquier tarea → Crea nueva tarea abajo
```

---

## Eventos de Teclado Soportados

| Tecla | Contexto | Acción |
|-------|----------|--------|
| `↑` | Título | Navega a tarea anterior |
| `↓` | Título | Navega a tarea siguiente |
| `Enter` | Título | Crea nueva tarea abajo |
| `Tab` | Título | Va a la descripción |
| `Backspace` | Título vacío | Elimina la tarea |
| `Escape` | Cualquiera | Cancela edición |
