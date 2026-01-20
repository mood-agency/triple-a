import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { DatabaseProvider } from './contexts/DatabaseContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="app-theme">
        <DatabaseProvider>
          <App />
        </DatabaseProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
