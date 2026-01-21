import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { toast } from 'sonner'

export function ResetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidSession, setIsValidSession] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      if (!supabase) {
        setIsCheckingSession(false)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      // User should have a session from the recovery link
      setIsValidSession(!!session)
      setIsCheckingSession(false)
    }

    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password.length < 6) {
      toast.error(t('auth.passwordTooShort'))
      return
    }

    if (password !== confirmPassword) {
      toast.error(t('auth.passwordMismatch'))
      return
    }

    if (!supabase) {
      toast.error(t('auth.resetError'))
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        toast.error(t('auth.resetError'), { description: error.message })
      } else {
        toast.success(t('auth.passwordUpdated'))
        navigate('/', { replace: true })
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  if (!isValidSession) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-end p-4">
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold text-center">
                {t('auth.invalidResetLink')}
              </CardTitle>
              <CardDescription className="text-center">
                {t('auth.invalidResetLinkDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                onClick={() => navigate('/auth', { replace: true })}
              >
                {t('auth.backToSignIn')}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              {t('auth.setNewPassword')}
            </CardTitle>
            <CardDescription className="text-center">
              {t('auth.setNewPasswordDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.newPassword')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t('auth.updatingPassword') : t('auth.updatePassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
