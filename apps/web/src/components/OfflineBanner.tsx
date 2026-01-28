import { CloudOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSync } from '@/contexts/SyncContext'

export function OfflineBanner() {
  const { t } = useTranslation()
  const isOnline = useOnlineStatus()
  const { pendingCount } = useSync()

  if (isOnline) return null

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-sm flex items-center justify-center gap-2">
      <CloudOff className="h-4 w-4" />
      <span>{t('sync.offlineBanner')}</span>
      {pendingCount > 0 && (
        <span className="font-medium">
          ({t('sync.pendingChanges', { count: pendingCount })})
        </span>
      )}
    </div>
  )
}
