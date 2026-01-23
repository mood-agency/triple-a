import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { Auth } from './pages/Auth'
import { ResetPassword } from './pages/ResetPassword'
import { AITest } from './pages/AITest'
import { Contacts } from './pages/Contacts'
import { Tasks } from './pages/Tasks'
import { useMobileDetect } from './hooks/useMobileDetect'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isConfigured } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
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

/**
 * Redirects mobile users to /tasks, desktop users see Home
 */
function HomeWithMobileRedirect() {
  const isMobile = useMobileDetect()

  if (isMobile) {
    return <Navigate to="/tasks" replace />
  }

  return <Home />
}

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeWithMobileRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/about"
        element={
          <ProtectedRoute>
            <About />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-test"
        element={
          <ProtectedRoute>
            <AITest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute>
            <Contacts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <Tasks />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
