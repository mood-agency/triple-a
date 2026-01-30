import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, RotateCcw, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { processNoteWithAI, type AIError } from '@/services/AIService';
import type { AIProviderConfig } from '@/hooks/useSettings';
import { markdownToBlockNote } from '@/utils/contentMigration';

interface AIAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  aiProvider: AIProviderConfig;
  onApply: (newContent: string) => void;
}

type DialogState = 'prompt' | 'loading' | 'result';

const PRESET_PROMPTS = [
  { key: 'summarize', icon: '📝' },
  { key: 'expand', icon: '📖' },
  { key: 'translate', icon: '🌐' },
  { key: 'correct', icon: '✏️' },
  { key: 'improve', icon: '✨' },
  { key: 'meetingMinutes', icon: '📋' },
] as const;

export function AIAssistantDialog({
  open,
  onOpenChange,
  content,
  aiProvider,
  onApply,
}: AIAssistantDialogProps) {
  const { t } = useTranslation();
  const [dialogState, setDialogState] = useState<DialogState>('prompt');
  const [prompt, setPrompt] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');

  const handleClose = () => {
    setDialogState('prompt');
    setPrompt('');
    setGeneratedContent('');
    setLastPrompt('');
    onOpenChange(false);
  };

  const handleProcess = async (customPrompt?: string) => {
    const promptToUse = customPrompt || prompt;
    if (!promptToUse.trim()) return;

    setDialogState('loading');
    setLastPrompt(promptToUse);

    try {
      const result = await processNoteWithAI({
        content,
        prompt: promptToUse,
        provider: aiProvider.provider,
        model: aiProvider.model,
        apiKey: aiProvider.apiKey,
      });

      setGeneratedContent(result.generatedContent);
      setDialogState('result');
    } catch (error) {
      const aiError = error as AIError;

      if (aiError.code === 'INVALID_API_KEY') {
        toast.error(t('ai.errors.invalidApiKey'));
      } else if (aiError.code === 'RATE_LIMIT') {
        toast.error(aiError.message);
      } else {
        toast.error(t('ai.errors.processingFailed'));
      }

      setDialogState('prompt');
    }
  };

  const handlePresetClick = (presetKey: string) => {
    // Use detailed prompt if available, otherwise fall back to label
    const promptKey = `ai.prompts.${presetKey}`;
    const labelKey = `ai.presets.${presetKey}`;
    const detailedPrompt = t(promptKey);
    // If no specific prompt exists, i18next returns the key itself
    const presetPrompt = detailedPrompt !== promptKey ? detailedPrompt : t(labelKey);
    setPrompt(presetPrompt);
    handleProcess(presetPrompt);
  };

  const handleRegenerate = () => {
    handleProcess(lastPrompt);
  };

  const handleApply = () => {
    // Convert Markdown to BlockNote format
    const blocks = markdownToBlockNote(generatedContent);
    const blockNoteJson = JSON.stringify(blocks);
    onApply(blockNoteJson);
    handleClose();
  };

  const handleBackToPrompt = () => {
    setDialogState('prompt');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            {dialogState === 'result'
              ? t('ai.assistant.result')
              : t('ai.assistant.title')}
          </DialogTitle>
          {dialogState === 'prompt' && (
            <DialogDescription>
              {t('ai.assistant.promptLabel')}
            </DialogDescription>
          )}
        </DialogHeader>

        {dialogState === 'prompt' && (
          <div className="flex flex-col gap-4 py-4 flex-shrink-0">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('ai.assistant.promptPlaceholder')}
              className="min-h-[100px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleProcess();
                }
              }}
            />

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {t('ai.assistant.suggestedPrompts')}
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESET_PROMPTS.map(({ key, icon }) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(key)}
                    className="gap-1.5"
                  >
                    <span>{icon}</span>
                    {t(`ai.presets.${key}`)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {dialogState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 flex-shrink-0">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <p className="text-muted-foreground">{t('ai.assistant.processing')}</p>
          </div>
        )}

        {dialogState === 'result' && (
          <div className="rounded-md border border-border bg-[#FBFCFD] dark:bg-muted/30 overflow-y-auto max-h-[50vh]">
            <div className="p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{generatedContent}</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0 pt-4 border-t mt-4">
          {dialogState === 'prompt' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                {t('ai.assistant.cancel')}
              </Button>
              <Button
                onClick={() => handleProcess()}
                disabled={!prompt.trim()}
                className="bg-purple-600 hover:bg-purple-700 gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t('ai.assistant.process')}
              </Button>
            </>
          )}

          {dialogState === 'result' && (
            <>
              <Button variant="outline" onClick={handleBackToPrompt} className="gap-1.5">
                <X className="h-4 w-4" />
                {t('ai.assistant.cancel')}
              </Button>
              <Button variant="outline" onClick={handleRegenerate} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                {t('ai.assistant.regenerate')}
              </Button>
              <Button onClick={handleApply} className="bg-purple-600 hover:bg-purple-700 gap-1.5">
                <Check className="h-4 w-4" />
                {t('ai.assistant.apply')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
