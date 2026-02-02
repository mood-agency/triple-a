import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

type AuthMode = 'signin' | 'signup'

export function AuthForm() {
  const { t } = useTranslation()
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const validateForm = (): boolean => {
    if (!email || !email.includes('@')) {
      toast.error(t('auth.invalidEmail'))
      return false
    }

    if (password.length < 6) {
      toast.error(t('auth.passwordTooShort'))
      return false
    }

    if (mode === 'signup' && password !== confirmPassword) {
      toast.error(t('auth.passwordMismatch'))
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) {
          toast.error(t('auth.signInError'), { description: error.message })
        }
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) {
          toast.error(t('auth.signUpError'), { description: error.message })
        } else {
          toast.success(t('auth.welcome'))
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  const getTitle = () => {
    switch (mode) {
      case 'signup':
        return t('auth.createAccountTitle')
      default:
        return t('auth.welcomeBack')
    }
  }

  const getButtonText = () => {
    if (isLoading) {
      switch (mode) {
        case 'signup':
          return t('auth.signingUp')
        default:
          return t('auth.signingIn')
      }
    }
    switch (mode) {
      case 'signup':
        return t('auth.signUp')
      default:
        return t('auth.signIn')
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          {getTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {mode === 'signup' && (
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
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {getButtonText()}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-2">
        {mode === 'signin' && (
          <p className="text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <button
              type="button"
              onClick={() => setMode('signup')}
              className="text-primary hover:underline underline-offset-4"
            >
              {t('auth.signUp')}
            </button>
          </p>
        )}
        {mode === 'signup' && (
          <p className="text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <button
              type="button"
              onClick={() => setMode('signin')}
              className="text-primary hover:underline underline-offset-4"
            >
              {t('auth.signIn')}
            </button>
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
