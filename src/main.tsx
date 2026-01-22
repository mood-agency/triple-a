import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { DatabaseProvider } from './contexts/DatabaseContext'
import { SyncProvider } from './contexts/SyncContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { AIProvider } from './contexts/AIContext'
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/sonner'
import './index.css'
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="app-theme">
        <TooltipProvider>
          <AuthProvider>
            <DatabaseProvider>
              <SyncProvider>
                <AIProvider>
                  <App />
                  <Toaster />
                </AIProvider>
              </SyncProvider>
            </DatabaseProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
