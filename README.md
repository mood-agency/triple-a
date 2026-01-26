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

### Desktop (Tauri)

| Comando              | Descripción                              |
|----------------------|------------------------------------------|
| `npm run tauri:dev`  | Inicia app de escritorio en modo desarrollo |
| `npm run tauri:build`| Compila app de escritorio para producción |

### Mobile (Capacitor)

| Comando                 | Descripción                              |
|-------------------------|------------------------------------------|
| `npm run cap:build`     | Compila web + sincroniza con Capacitor   |
| `npm run cap:android`   | Abre proyecto en Android Studio          |
| `npm run cap:ios`       | Abre proyecto en Xcode (requiere Mac)    |
| `npm run cap:run:android`| Ejecuta en dispositivo/emulador Android |

## Compilar para Mobile (Android)

### Requisitos
- Android Studio instalado
- JDK 17+
- Android SDK (API 33+)

### Pasos

1. **Compilar y sincronizar**
   ```bash
   npm run cap:build
   ```

2. **Abrir en Android Studio**
   ```bash
   npm run cap:android
   ```

3. **En Android Studio:**
   - Espera a que Gradle sincronice el proyecto
   - Selecciona un dispositivo/emulador
   - Click en "Run" (o Shift+F10)

### Generar APK de Release

1. En Android Studio: `Build > Generate Signed Bundle / APK`
2. Selecciona "APK"
3. Crea o selecciona un keystore
4. Selecciona "release" como build variant
5. El APK estará en `android/app/release/`

### Funcionalidad Share Target

La app puede recibir contenido compartido desde otras aplicaciones:
- Comparte texto o URLs desde cualquier app (Chrome, Twitter, etc.)
- Selecciona "Triple A" en el menú de compartir
- El contenido se abrirá en un formulario para crear una nueva tarea

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
