import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Plus, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAPIKeys } from '@/hooks/useAPIKeys';
import { APIKeyCard } from './APIKeyCard';
import { CreateAPIKeyDialog } from './CreateAPIKeyDialog';

interface APIKeysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function APIKeysDialog({ open, onOpenChange }: APIKeysDialogProps) {
  const { t } = useTranslation();
  const { apiKeys, loading, error, createAPIKey, revokeAPIKey } = useAPIKeys();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t('apiKeys.title')}
            </DialogTitle>
            <DialogDescription>
              {t('apiKeys.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Error State */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loading State */}
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && apiKeys.length === 0 && (
              <div className="text-center py-12">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">{t('apiKeys.empty.title')}</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  {t('apiKeys.empty.description')}
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('apiKeys.empty.createFirst')}
                </Button>
              </div>
            )}

            {/* API Keys List */}
            {!loading && !error && apiKeys.length > 0 && (
              <div className="space-y-3">
                {apiKeys.map((apiKey) => (
                  <APIKeyCard
                    key={apiKey.id}
                    apiKey={apiKey}
                    onRevoke={async (id) => {
                      await revokeAPIKey(id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Create Button (when there are existing keys) */}
          {!loading && !error && apiKeys.length > 0 && (
            <div className="border-t pt-4">
              <Button onClick={() => setShowCreateDialog(true)} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                {t('apiKeys.createNew')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <CreateAPIKeyDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateKey={createAPIKey}
      />
    </>
  );
}
