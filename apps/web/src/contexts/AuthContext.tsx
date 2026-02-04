import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isConfigured: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isConfigured = isSupabaseConfigured()
  // Track current user ID to avoid unnecessary re-renders on token refresh
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const newUserId = session?.user?.id ?? null
      // Only update user/session if user ID actually changed (avoids duplicate
      // object references from StrictMode double-mounting calling getSession twice)
      if (newUserId !== currentUserIdRef.current) {
        currentUserIdRef.current = newUserId
        setSession(session)
        setUser(session?.user ?? null)
      }
      setIsLoading(false)
    }).catch((error) => {
      console.error('[Auth] Failed to get session:', error)
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null

      // Only update user state if user ID actually changed
      // This prevents cascading re-renders when Supabase refreshes the token on tab focus
      if (newUserId !== currentUserIdRef.current) {
        currentUserIdRef.current = newUserId
        setSession(session)
        setUser(session?.user ?? null)
      }
      setIsLoading(false)

      // Redirect to reset password page on PASSWORD_RECOVERY event
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/reset-password'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: { message: 'Supabase not configured' } as AuthError }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    if (!supabase) return { error: { message: 'Supabase not configured' } as AuthError }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    return { error }
  }

  const signInWithGoogle = async () => {
    if (!supabase) return { error: { message: 'Supabase not configured' } as AuthError }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    return { error }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    if (!supabase) return { error: { message: 'Supabase not configured' } as AuthError }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isConfigured,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
