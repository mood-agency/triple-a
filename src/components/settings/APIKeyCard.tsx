import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Eye, EyeOff, Calendar, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { APIKey } from '@/types/api';

interface APIKeyCardProps {
  apiKey: APIKey;
  onRevoke: (id: string) => Promise<void>;
}

export function APIKeyCard({ apiKey, onRevoke }: APIKeyCardProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    try {
      setIsRevoking(true);
      await onRevoke(apiKey.id);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error revoking API key:', error);
    } finally {
      setIsRevoking(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('apiKeys.never');
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = apiKey.expires_at && new Date(apiKey.expires_at) < new Date();

  const scopeColors: Record<string, string> = {
    read: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    write: 'bg-green-500/10 text-green-500 border-green-500/20',
    delete: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <>
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Name */}
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-medium truncate">{apiKey.name}</h4>
              {isExpired && (
                <Badge variant="destructive" className="text-xs">
                  {t('apiKeys.expired')}
                </Badge>
              )}
            </div>

            {/* Key Prefix */}
            <div className="flex items-center gap-2 mb-3">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                {apiKey.key_prefix}
              </code>
            </div>

            {/* Scopes */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {apiKey.scopes.map((scope) => (
                <Badge
                  key={scope}
                  variant="outline"
                  className={`text-xs ${scopeColors[scope] || ''}`}
                >
                  {t(`apiKeys.scopes.${scope}`)}
                </Badge>
              ))}
            </div>

            {/* Metadata */}
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3" />
                <span>
                  {t('apiKeys.lastUsed')}: {formatDate(apiKey.last_used_at)}
                </span>
              </div>

              {apiKey.expires_at && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {t('apiKeys.expires')}: {formatDate(apiKey.expires_at)}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span>
                  {t('apiKeys.rateLimit')}: {apiKey.rate_limit} {t('apiKeys.requestsPerMinute')}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('apiKeys.revokeDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('apiKeys.revokeDialog.description')}
              <br />
              <br />
              <strong>{apiKey.name}</strong> ({apiKey.key_prefix})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRevoking}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={isRevoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? t('common.revoking') : t('common.revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
