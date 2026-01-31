import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import { useIsMobile } from './hooks/use-mobile'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { Auth } from './pages/Auth'
import { ResetPassword } from './pages/ResetPassword'
import { Contacts } from './pages/Contacts'
import { Analytics } from './pages/Analytics'
import { Labels } from './pages/Labels'
import { Projects } from './pages/Projects'
import { MobileTaskCreate } from './pages/MobileTaskCreate'
import { CalendarSettings } from './pages/CalendarSettings'
import ShareReceiver from './pages/ShareReceiver'
import { PublicNote } from './pages/PublicNote'
import { MainLayout } from './components/MainLayout'
import { AuthenticatedProviders } from './components/AuthenticatedProviders'
import { BlockNotePoC } from './pages/BlockNotePoC'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isConfigured } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Allow access if:
  // 1. Supabase is not configured (offline-only mode)
  // 2. User is authenticated
  // 3. User chose to continue in offline mode
  const offlineMode = localStorage.getItem('offlineMode') === 'true'

  if (!isConfigured || user || offlineMode) {
    return <>{children}</>
  }

  return <Navigate to="/auth" replace />
}

// Component that redirects to mobile view if on mobile device
function MobileRedirect({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <Navigate to="/mobile/create" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Public routes - no data fetching providers */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/p/:slug" element={<PublicNote />} />

      {/* Protected routes - wrapped with data providers */}
      <Route
        path="/mobile/create"
        element={
          <ProtectedRoute>
            <AuthenticatedProviders>
              <MobileTaskCreate />
            </AuthenticatedProviders>
          </ProtectedRoute>
        }
      />
      <Route
        path="/share"
        element={
          <ProtectedRoute>
            <AuthenticatedProviders>
              <ShareReceiver />
            </AuthenticatedProviders>
          </ProtectedRoute>
        }
      />
      {/* Routes with shared sidebar layout */}
      <Route
        element={
          <ProtectedRoute>
            <AuthenticatedProviders>
              <MobileRedirect>
                <MainLayout />
              </MobileRedirect>
            </AuthenticatedProviders>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/labels" element={<Labels />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/callback" element={<Projects />} />
        <Route path="/settings/calendar" element={<CalendarSettings />} />
        <Route path="/settings/calendar/callback" element={<CalendarSettings />} />
        <Route path="/blocknote-poc" element={<BlockNotePoC />} />
      </Route>
    </Routes>
  )
}

export default App
