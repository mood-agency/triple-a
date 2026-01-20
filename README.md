# Triple-A

Aplicación React con TypeScript, Vite, internacionalización y componentes shadcn/ui.

## Requisitos

- Node.js 18+
- npm 9+

## Inicialización del Proyecto

```bash
# Clonar el repositorio
git clone <url-del-repositorio>
cd triple-a

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:11000`

## Scripts Disponibles

| Comando           | Descripción                              |
|-------------------|------------------------------------------|
| `npm run dev`     | Inicia servidor de desarrollo con HMR   |
| `npm run build`   | Compila TypeScript y construye para producción |
| `npm run lint`    | Ejecuta ESLint                           |
| `npm run preview` | Previsualiza build de producción         |

## Tecnologías

- **React 19** - Biblioteca UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool y dev server
- **React Router v7** - Enrutamiento
- **i18next** - Internacionalización (ES/EN)
- **shadcn/ui** - Componentes UI (basados en Radix UI)
- **Tailwind CSS v4** - Framework de estilos

## Estructura del Proyecto

```
src/
├── pages/          # Componentes de página (Home, About)
├── components/ui/  # Componentes shadcn/ui
├── i18n/locales/   # Archivos de traducción (en.json, es.json)
├── lib/            # Utilidades
└── App.tsx         # Configuración de rutas
```
