import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './contexts/AuthContext'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { Auth } from './pages/Auth'
import { ResetPassword } from './pages/ResetPassword'
import { Contacts } from './pages/Contacts'
import { Analytics } from './pages/Analytics'
import { Labels } from './pages/Labels'
import { MobileTaskCreate } from './pages/MobileTaskCreate'
import { MainLayout } from './components/MainLayout'

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

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/mobile/create"
        element={
          <ProtectedRoute>
            <MobileTaskCreate />
          </ProtectedRoute>
        }
      />
      {/* Routes with shared sidebar layout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contacts" element={<Contacts />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/labels" element={<Labels />} />
      </Route>
    </Routes>
  )
}

export default App
