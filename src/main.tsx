import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DatabaseProvider } from './contexts/DatabaseContext'
import { TinyBaseProvider } from './contexts/TinyBaseContext'
import { SyncProvider } from './contexts/SyncContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/sonner'
import { getFlag } from './config/featureFlags'
import './index.css'
import './i18n'
import App from './App.tsx'

// Check feature flag at startup
const useTinyBase = getFlag('useTinyBase')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="app-theme">
        <TooltipProvider>
          <AuthProvider>
            <DatabaseProvider skipInit={useTinyBase}>
              <TinyBaseProvider skipInit={!useTinyBase}>
                <SyncProvider>
                  <App />
                  <Toaster />
                </SyncProvider>
              </TinyBaseProvider>
            </DatabaseProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
