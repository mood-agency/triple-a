# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start development server with HMR
npm run build    # Type-check with tsc then build with Vite
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Architecture Overview

React 19 + TypeScript + Vite application with internationalization and routing.

### Tech Stack
- **React 19** with React Router v7 for client-side routing
- **i18next** for internationalization (default: Spanish, fallback: English)
- **shadcn/ui** components built on Radix UI primitives
- **Tailwind CSS v4** with CSS variables for theming

### Project Structure

```
src/
├── pages/          # Route components (Home, About)
├── components/ui/  # shadcn/ui components
├── i18n/
│   ├── index.ts    # i18next configuration
│   └── locales/    # Translation files (en.json, es.json)
├── lib/utils.ts    # cn() helper for class merging
└── App.tsx         # Router configuration
```

### Path Aliases
`@/*` resolves to `./src/*` (configured in both Vite and TypeScript).

### Adding Components
Use shadcn/ui CLI or manually add to `src/components/ui/`. Components use CVA (class-variance-authority) for variants.

### shadcn/ui Guidelines
**IMPORTANT: Always use official shadcn/ui components and styles.**

- **Never manually modify** shadcn/ui component styles (button variants, sizes, colors, etc.)
- **To add/update components**, use the CLI: `pnpm dlx shadcn@latest add <component> -o`
- **Style**: `new-york` (configured in `components.json`)
- **Base color**: `neutral`
- If a user asks for style changes to shadcn components, suggest using the CLI to reinstall or check the official docs
- For custom styling needs, add className overrides at the usage site, not in the component file
- Official docs: https://ui.shadcn.com/docs/components

### Adding Translations
Add keys to both `src/i18n/locales/en.json` and `src/i18n/locales/es.json`. Use `useTranslation()` hook to access translations in components.
