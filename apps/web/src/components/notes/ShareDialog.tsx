import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Link, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ShareDialogProps {
  isPublic: boolean;
  publicSlug: string | null;
  onTogglePublic: () => Promise<string | null>;
  trigger?: React.ReactNode;
}

export function ShareDialog({
  isPublic,
  publicSlug,
  onTogglePublic,
  trigger,
}: ShareDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const publicUrl = publicSlug ? `${window.location.origin}/p/${publicSlug}` : '';

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const slug = await onTogglePublic();
      if (slug) {
        toast.success(t('sharing.linkCopied'));
      } else {
        toast.success(t('sharing.linkRemoved'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success(t('sharing.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Globe className={`h-3.5 w-3.5 ${isPublic ? 'text-green-600' : ''}`} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t('sharing.sharePublicly')}
          </DialogTitle>
          <DialogDescription>
            {t('sharing.shareDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Toggle public/private */}
          <div className="flex items-center justify-between">
            <Label htmlFor="public-toggle" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              {t('sharing.makePublic')}
            </Label>
            <Switch
              id="public-toggle"
              checked={isPublic}
              onCheckedChange={handleToggle}
              disabled={isLoading}
            />
          </div>

          {/* Public URL */}
          {isPublic && publicUrl && (
            <div className="space-y-2">
              <Label>{t('sharing.publicLink')}</Label>
              <div className="flex gap-2">
                <Input
                  value={publicUrl}
                  readOnly
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
