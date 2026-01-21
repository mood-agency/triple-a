import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { AuthForm } from '@/components/auth/AuthForm'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { WifiOff } from 'lucide-react'
import { useEffect } from 'react'

export function Auth() {
  const { t } = useTranslation()
  const { user, isLoading, isConfigured } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const handleContinueOffline = () => {
    localStorage.setItem('offlineMode', 'true')
    navigate('/', { replace: true })
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-end p-4">
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          {isConfigured ? (
            <>
              <AuthForm />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('auth.or')}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleContinueOffline}
              >
                <WifiOff className="mr-2 h-4 w-4" />
                {t('auth.continueOffline')}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                {t('auth.offlineModeDescription')}
              </p>
            </>
          ) : (
            <div className="space-y-6 text-center">
              <div className="space-y-2">
                <WifiOff className="mx-auto h-12 w-12 text-muted-foreground" />
                <h1 className="text-2xl font-bold">{t('auth.offlineMode')}</h1>
                <p className="text-muted-foreground">
                  {t('auth.offlineModeDescription')}
                </p>
              </div>

              <Button
                className="w-full"
                onClick={handleContinueOffline}
              >
                {t('auth.continueOffline')}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
