import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, Copy, Check, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CreateAPIKeyInput, CreateAPIKeyResponse, APIKeyScope } from '@/types/api';

interface CreateAPIKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateKey: (input: CreateAPIKeyInput) => Promise<CreateAPIKeyResponse | null>;
}

export function CreateAPIKeyDialog({ open, onOpenChange, onCreateKey }: CreateAPIKeyDialogProps) {
  const { t } = useTranslation();

  // Form state
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<APIKeyScope[]>(['read']);
  const [rateLimit, setRateLimit] = useState('100');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);

  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateAPIKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const handleScopeToggle = (scope: APIKeyScope, checked: boolean) => {
    if (checked) {
      setScopes([...scopes, scope]);
    } else {
      setScopes(scopes.filter(s => s !== scope));
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || scopes.length === 0) {
      return;
    }

    try {
      setIsCreating(true);

      const input: CreateAPIKeyInput = {
        name: name.trim(),
        scopes,
        rate_limit: parseInt(rateLimit),
        expires_at: expiresAt ? expiresAt.toISOString() : undefined,
      };

      const result = await onCreateKey(input);
      if (result) {
        setCreatedKey(result);
      }
    } catch (error) {
      console.error('Error creating API key:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (createdKey?.full_key) {
      await navigator.clipboard.writeText(createdKey.full_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    // Reset form
    setName('');
    setScopes(['read']);
    setRateLimit('100');
    setExpiresAt(undefined);
    setCreatedKey(null);
    setCopied(false);
    onOpenChange(false);
  };

  // Show the created key
  if (createdKey) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              {t('apiKeys.create.success')}
            </DialogTitle>
            <DialogDescription>
              {t('apiKeys.create.saveWarning')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {t('apiKeys.create.onlyOnce')}
              </AlertDescription>
            </Alert>

            <div>
              <Label>{t('apiKeys.create.keyName')}</Label>
              <div className="text-sm font-medium mt-1">{createdKey.api_key.name}</div>
            </div>

            <div>
              <Label>{t('apiKeys.create.apiKey')}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={createdKey.full_key}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyKey}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleClose}>
              {t('common.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Show the creation form
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            {t('apiKeys.create.title')}
          </DialogTitle>
          <DialogDescription>
            {t('apiKeys.create.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="name">{t('apiKeys.create.name')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('apiKeys.create.namePlaceholder')}
              className="mt-1.5"
            />
          </div>

          {/* Scopes */}
          <div>
            <Label>{t('apiKeys.create.scopes')}</Label>
            <div className="space-y-2 mt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="scope-read"
                  checked={scopes.includes('read')}
                  onCheckedChange={(checked) => handleScopeToggle('read', checked as boolean)}
                />
                <label
                  htmlFor="scope-read"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t('apiKeys.scopes.read')} - {t('apiKeys.scopes.readDescription')}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="scope-write"
                  checked={scopes.includes('write')}
                  onCheckedChange={(checked) => handleScopeToggle('write', checked as boolean)}
                />
                <label
                  htmlFor="scope-write"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t('apiKeys.scopes.write')} - {t('apiKeys.scopes.writeDescription')}
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="scope-delete"
                  checked={scopes.includes('delete')}
                  onCheckedChange={(checked) => handleScopeToggle('delete', checked as boolean)}
                />
                <label
                  htmlFor="scope-delete"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {t('apiKeys.scopes.delete')} - {t('apiKeys.scopes.deleteDescription')}
                </label>
              </div>
            </div>
          </div>

          {/* Rate Limit */}
          <div>
            <Label htmlFor="rate-limit">{t('apiKeys.create.rateLimit')}</Label>
            <Input
              id="rate-limit"
              type="number"
              min="10"
              max="10000"
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('apiKeys.create.rateLimitHelp')}
            </p>
          </div>

          {/* Expiry Date (Optional) */}
          <div>
            <Label>{t('apiKeys.create.expiresAt')}</Label>
            <DatePicker
              date={expiresAt}
              onDateChange={setExpiresAt}
              placeholder={t('apiKeys.create.noExpiration')}
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !name.trim() || scopes.length === 0}
          >
            {isCreating ? t('common.creating') : t('apiKeys.create.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
