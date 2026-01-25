import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { TinyBaseProvider } from './contexts/TinyBaseContext'
import { SyncProvider } from './contexts/SyncContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProjectProvider } from './contexts/ProjectContext'
import { GoogleCalendarProvider } from './contexts/GoogleCalendarContext'
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/sonner'
import './index.css'
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider defaultTheme="system" storageKey="app-theme">
        <TooltipProvider delayDuration={500}>
          <AuthProvider>
            <TinyBaseProvider>
              <SyncProvider>
                <ProjectProvider>
                  <GoogleCalendarProvider>
                    <App />
                    <Toaster />
                  </GoogleCalendarProvider>
                </ProjectProvider>
              </SyncProvider>
            </TinyBaseProvider>
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
