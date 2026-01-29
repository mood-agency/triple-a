import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { SendIntent } from 'send-intent'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/sonner'
import './index.css'
import './i18n'
import App from './App.tsx'

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[UnhandledRejection]', event.reason)
})

// Handle shared content from other apps (Android/iOS)
async function handleSharedContent() {
  if (!Capacitor.isNativePlatform()) return

  try {
    const result = await SendIntent.checkSendIntentReceived()
    if (result) {
      // Build URL params from shared content
      const params = new URLSearchParams()
      if (result.title) params.set('title', result.title)
      if (result.description) params.set('text', result.description)
      if (result.url) params.set('url', result.url)

      // Navigate to share receiver page
      if (params.toString()) {
        window.location.href = `/share?${params.toString()}`
      }
    }
  } catch (error) {
    console.error('Error checking shared intent:', error)
  }
}

// Check for shared content when app starts
handleSharedContent()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider defaultTheme="system" storageKey="app-theme">
          <TooltipProvider delayDuration={500} disableHoverableContent>
            <AuthProvider>
              <App />
              <Toaster />
            </AuthProvider>
          </TooltipProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
