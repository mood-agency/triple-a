import { useTranslation } from 'react-i18next'
import { useSync } from '@/contexts/SyncContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function SyncStatus() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { connectionStatus, syncState, lastSyncedAt, pendingCount, error, syncNow } = useSync()

  // Don't show sync status if user is not logged in
  if (!user) return null

  const getIcon = () => {
    if (connectionStatus === 'offline') {
      return <CloudOff className="h-4 w-4" />
    }
    if (syncState === 'syncing') {
      return <RefreshCw className="h-4 w-4 animate-spin" />
    }
    if (syncState === 'error' || error) {
      return <AlertCircle className="h-4 w-4" />
    }
    if (pendingCount > 0) {
      return <Cloud className="h-4 w-4" />
    }
    return <Check className="h-4 w-4" />
  }

  const getStatusText = () => {
    if (connectionStatus === 'offline') {
      return t('sync.offline')
    }
    if (syncState === 'syncing') {
      return t('sync.syncing')
    }
    if (syncState === 'error' || error) {
      return t('sync.error')
    }
    if (pendingCount > 0) {
      return t('sync.pending')
    }
    return t('sync.synced')
  }

  const getStatusColor = () => {
    if (connectionStatus === 'offline') {
      return 'text-muted-foreground'
    }
    if (syncState === 'error' || error) {
      return 'text-destructive'
    }
    if (pendingCount > 0) {
      return 'text-yellow-500'
    }
    return 'text-green-500'
  }

  const formatLastSync = () => {
    if (!lastSyncedAt) return t('sync.never')

    const date = new Date(lastSyncedAt)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    return date.toLocaleDateString()
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('gap-2', getStatusColor())}
          onClick={() => syncNow()}
          disabled={syncState === 'syncing' || connectionStatus === 'offline'}
        >
          {getIcon()}
          {pendingCount > 0 && (
            <span className="text-xs">{pendingCount}</span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{getStatusText()}</p>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t('sync.lastSync')}: {formatLastSync()}
          </p>
          {connectionStatus !== 'offline' && syncState !== 'syncing' && (
            <p className="text-xs text-muted-foreground">
              {t('sync.syncNow')}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
