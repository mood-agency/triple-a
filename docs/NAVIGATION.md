# Navegación y Atajos de Teclado

## Flujo General de Navegación

La aplicación sigue un modelo de navegación por teclado similar a un editor de texto, con tres zonas principales:

```
┌─────────────────────────────────────────────────────────────────┐
│                        BARRA DE BÚSQUEDA                        │
│                         (Ctrl+F para enfocar)                   │
├─────────────────────────────────┬───────────────────────────────┤
│                                 │                               │
│      PANEL IZQUIERDO            │      PANEL DERECHO            │
│      Lista de Tareas            │      Descripción              │
│                                 │      (se expande con Tab)     │
│   ┌─────────────────────────┐   │                               │
│   │ Tarea 1                 │   │   ┌───────────────────────┐   │
│   ├─────────────────────────┤   │   │                       │   │
│   │ Tarea 2  ← caret aquí   │◄──┼──►│  Editor de            │   │
│   ├─────────────────────────┤   │   │  descripción          │   │
│   │ Tarea 3                 │   │   │                       │   │
│   └─────────────────────────┘   │   └───────────────────────┘   │
│                                 │                               │
│   ↑/↓ para navegar              │   Escape para cerrar          │
│                                 │                               │
└─────────────────────────────────┴───────────────────────────────┘
```

### Transiciones de Foco

| Desde | Acción | Hacia |
|-------|--------|-------|
| Buscador | `↓` | Primera tarea |
| Título de tarea | `Tab` | Panel de descripción |
| Título de tarea | `↑/↓` | Tarea anterior/siguiente |
| Descripción | `Escape` | Título de la tarea |

---

## Atajos de Teclado Implementados

### Globales

Funcionan desde cualquier parte de la aplicación:

| Atajo | Acción |
|-------|--------|
| `Ctrl+K` | Abrir Command Palette |
| `Ctrl+F` | Enfocar barra de búsqueda |
| `Alt+S` | Toggle sidebar izquierdo |
| `Alt+Q` | Filtrar por categoría "Por Hacer" (toggle) |
| `Alt+W` | Filtrar por categoría "Seguimiento" (toggle) |
| `Alt+E` | Filtrar por categoría "Notas" (toggle) |
| `Alt+R` | Filtrar por categoría "Reunión" (toggle) |
| `Alt+C` | Limpiar todos los filtros |
| `Alt+T` | Abrir selector de fecha límite |
| `Alt+V` | Alternar vista lista/calendario |
| `Alt+F` | Toggle vista compacta de tareas |
| `Alt+P` | Abrir filtro de asignados |
| `Escape` | Deseleccionar tarea actual |

### En la Barra de Búsqueda

| Atajo | Acción |
|-------|--------|
| `↓` | Seleccionar primera tarea de los resultados |
| `Escape` | Limpiar búsqueda |

### En el Título de Tarea

| Atajo | Acción |
|-------|--------|
| `↑` | Navegar a la tarea anterior (mantiene columna del cursor) |
| `↓` | Navegar a la tarea siguiente (mantiene columna del cursor) |
| `Enter` | Crear nueva tarea debajo |
| `Tab` | Expandir panel de descripción y enfocar editor |
| `Backspace` | Eliminar tarea (solo si el título está vacío) |
| `Ctrl+D` | Marcar/desmarcar como completada |
| `Ctrl+Backspace` | Eliminar tarea |
| `Ctrl+L` | Abrir selector de etiquetas |
| `Escape` | Revertir cambios sin perder foco |

### En el Panel de Descripción

| Atajo | Acción |
|-------|--------|
| `Escape` | Guardar y cerrar panel, volver al título |
| `Ctrl+D` | Marcar/desmarcar tarea como completada |
| `↓` (al final del texto) | Navegar a la siguiente tarea |
| `↑` (al inicio del texto) | Navegar a la tarea anterior o al título |

---

## Sistema de Preservación de Columna

Al navegar verticalmente entre tareas con `↑/↓`, el sistema recuerda la posición horizontal del cursor:

```
Tarea 1: Comprar leche|          ← cursor en posición 14
              ↓
Tarea 2: Revisar correos largos  ← cursor se mantiene en posición 14
              ↓
Tarea 3: Hola                    ← texto más corto, cursor va al final (pos 4)
```

**Implementación:** Se guarda en `desiredColumn` y se aplica con `setSelectionRange(pos, pos)`.

---

## Cambios Pendientes (TODO)

### Comportamiento deseado no implementado:

- [ ] **Focus inicial**: Al cargar la página, el caret debe posicionarse automáticamente en la primera tarea
- [ ] **↑ en primera tarea → buscador**: Cuando el usuario está en la primera tarea y presiona `↑`, el foco debe ir a la barra de búsqueda
- [ ] **↓ en última tarea**: Actualmente puede tener comportamiento inconsistente; debe no hacer nada

### Mejoras sugeridas:

- [ ] Extender `FocusTarget` para incluir `'search'`:
  ```typescript
  type FocusTarget = 'search' | 'title' | 'description-start' | 'description-end' | null;
  ```

---

## Arquitectura Técnica

### Librería de Atajos

Se usa **react-hotkeys-hook v5.2.3** con un patrón de capas jerárquicas:

```
┌─────────────────────────────────────────────────┐
│ Capa Global (Home.tsx)                          │
│   Alt+S, Ctrl+K                                 │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ Capa de Lista (NoteList.tsx)                    │
│   Ctrl+F, Tab, Escape, Alt+Q/W/E/R/C/T/V/F/P    │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ Capa de Fila (useNoteRow.ts)                    │
│   ↑/↓, Enter, Backspace, Ctrl+D, Ctrl+Backspace │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ Capa de Descripción                             │
│   Escape, Shift+Tab, ↑/↓ en bordes              │
└─────────────────────────────────────────────────┘
```

### Estados de Foco

Manejados en `useNoteSelection.ts`:

```typescript
type FocusTarget = 'title' | 'description-start' | 'description-end' | null;
```

### Archivos Clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/components/notes/NoteList.tsx` | Orquestador principal, atajos de nivel lista |
| `src/hooks/useNoteRow.ts` | Navegación entre tareas, atajos de fila |
| `src/hooks/useNoteSelection.ts` | Máquina de estados de foco |
| `src/components/CommandPalette.tsx` | Command Palette (Ctrl+K) |
| `src/components/ui/EditableDescription.tsx` | Editor de descripción con TipTap |
| `src/hooks/useDebugNavigation.tsx` | Debug visual con `?debug=nav` |

---

## Modo Debug

Añadir `?debug=nav` a la URL para activar indicadores visuales:

- **Anillo rojo**: Fila seleccionada
- **Anillo verde**: Título con foco
- **Anillo púrpura**: Descripción con foco
- **Anillo azul**: Elemento actualmente enfocado
- **Overlay**: Estado de navegación en tiempo real (esquina inferior derecha)
