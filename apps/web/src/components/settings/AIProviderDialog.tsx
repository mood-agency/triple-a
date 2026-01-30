import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, CheckCircle } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings, type AIProvider, AI_MODELS } from '@/hooks/useSettings';

interface AIProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getProviderInfo = (provider: AIProvider) => {
  switch (provider) {
    case 'groq':
      return { name: 'Groq', placeholder: 'gsk_...', url: 'https://console.groq.com/keys' };
    case 'openai':
      return { name: 'OpenAI', placeholder: 'sk-...', url: 'https://platform.openai.com/api-keys' };
    case 'anthropic':
      return { name: 'Anthropic', placeholder: 'sk-ant-...', url: 'https://console.anthropic.com/settings/keys' };
  }
};

export function AIProviderDialog({ open, onOpenChange }: AIProviderDialogProps) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const [providerInput, setProviderInput] = useState<AIProvider>('groq');
  const [modelInput, setModelInput] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    if (open) {
      const provider = settings.aiProvider?.provider || 'groq';
      setProviderInput(provider);
      setModelInput(settings.aiProvider?.model || AI_MODELS[provider][0].id);
      setApiKeyInput(settings.aiProvider?.apiKey || '');
    }
  }, [open, settings.aiProvider]);

  // Reset model when provider changes
  const handleProviderChange = (provider: AIProvider) => {
    setProviderInput(provider);
    setModelInput(AI_MODELS[provider][0].id);
  };

  const handleClose = () => {
    onOpenChange(false);
    setApiKeyInput('');
  };

  const handleSave = () => {
    if (apiKeyInput.trim()) {
      updateSettings({
        aiProvider: {
          provider: providerInput,
          model: modelInput,
          apiKey: apiKeyInput.trim(),
        },
      });
    } else {
      updateSettings({ aiProvider: null });
    }
    onOpenChange(false);
  };

  const models = AI_MODELS[providerInput];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            {t('ai.title')}
          </DialogTitle>
          <DialogDescription>
            {t('ai.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t('ai.provider')}</Label>
            <Select
              value={providerInput}
              onValueChange={(value) => handleProviderChange(value as AIProvider)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>{t('ai.model')}</Label>
            <Select
              value={modelInput}
              onValueChange={setModelInput}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-api-key">{t('ai.apiKey')}</Label>
            <Input
              id="ai-api-key"
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={getProviderInfo(providerInput).placeholder}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t('ai.help')}{' '}
            <a
              href={getProviderInfo(providerInput).url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:underline"
            >
              {getProviderInfo(providerInput).url.replace('https://', '')}
            </a>
          </p>

          {settings.aiProvider && (
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              {t('ai.configured', { provider: getProviderInfo(settings.aiProvider.provider).name })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} className="bg-purple-600 hover:bg-purple-700">
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
