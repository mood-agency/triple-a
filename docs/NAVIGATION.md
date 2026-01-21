# Navegación y Atajos de Teclado

## Descripción General

La lista de tareas se comporta como un documento de texto continuo, permitiendo navegar con el teclado de forma natural, similar a un editor de texto como Notepad.

---

## Atajos de Teclado Globales

Estos atajos funcionan desde cualquier parte de la aplicación (excepto cuando se está escribiendo en un campo de texto).

| Atajo | Acción |
|-------|--------|
| `Ctrl+K` | Abrir Command Palette |
| `Ctrl+F` | Enfocar barra de búsqueda |
| `Ctrl+A` | Filtrar por categoría "Por Hacer" (toggle) |
| `Ctrl+S` | Filtrar por categoría "Seguimiento" (toggle) |
| `Ctrl+D` | Filtrar por categoría "Notas" (toggle) |
| `Ctrl+C` | Limpiar todos los filtros |
| `↑` | Seleccionar última tarea (si ninguna está seleccionada) |
| `↓` | Seleccionar primera tarea (si ninguna está seleccionada) |
| `Escape` | Deseleccionar tarea actual |

---

## Atajos en el Título de Tarea

Cuando el cursor está en el título de una tarea:

| Atajo | Acción |
|-------|--------|
| `↑` | Navegar a la tarea anterior (mantiene columna) |
| `↓` | Navegar a la tarea siguiente (mantiene columna) |
| `Enter` | Crear nueva tarea debajo |
| `Tab` | Ir a la descripción de la tarea |
| `Backspace` | Eliminar tarea (si el título está vacío) |
| `Ctrl+D` | Marcar/desmarcar como completada |
| `Ctrl+Backspace` | Eliminar tarea |
| `Ctrl+L` | Abrir selector de etiquetas |

---

## Atajos en la Descripción

Cuando el cursor está en la descripción de una tarea:

| Atajo | Acción |
|-------|--------|
| `Shift+Tab` | Volver al título de la tarea |

---

## Atajos en la Barra de Búsqueda

| Atajo | Acción |
|-------|--------|
| `↓` | Seleccionar primera tarea de los resultados |
| `Escape` | Limpiar búsqueda |

---

## Navegación Detallada

### Click en Título de Tarea

**Comportamiento:** Al hacer click en el título de una tarea, el caret se posiciona automáticamente en el texto, en la posición exacta donde se hizo click.

**Implementación:**
- Se calcula la posición del click relativa al texto
- Se usa `canvas.measureText()` para determinar el carácter exacto
- El input recibe foco con `setSelectionRange(pos, pos)`

---

### Navegación Vertical (↑/↓)

**Comportamiento:** Al presionar las flechas, el cursor salta al título de la tarea adyacente manteniendo la posición horizontal (columna).

**Requisitos:**
- El input de la tarea destino debe estar en modo edición
- El caret debe estar visible y activo
- El usuario puede escribir inmediatamente sin hacer click

**Preservación de columna:**
- Si la nueva línea es más corta que la posición actual, el cursor va al final
- Si es igual o más larga, mantiene la misma columna

---

### Creación de Nueva Tarea (Enter)

**Flujo:**
1. Guarda el contenido actual de la tarea
2. Crea una nueva tarea con contenido vacío
3. Calcula el `sort_order` para posicionarla correctamente
4. Selecciona automáticamente la nueva tarea
5. El input de la nueva tarea recibe foco con el caret al inicio
6. El usuario puede comenzar a escribir inmediatamente

---

### Sistema de Preservación de Columna

**Concepto:** Al navegar verticalmente entre tareas, el sistema recuerda la posición horizontal del cursor.

**Comportamiento:**
1. Al presionar ↑ o ↓, se captura la posición actual: `selectionStart`
2. Se guarda en `desiredColumn`
3. Al enfocar la nueva tarea, se aplica: `setSelectionRange(pos, pos)`
4. Si el texto es más corto, se usa `Math.min(desiredColumn, text.length)`

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

## Archivos Clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/components/notes/NoteList.tsx` | Orquestador principal de navegación y atajos globales |
| `src/components/CommandPalette.tsx` | Command Palette (Ctrl+K) |
| `src/components/ui/EditableDescription.tsx` | Edición de descripciones con TipTap |
| `src/hooks/useNotes.ts` | CRUD y persistencia en base de datos |
