import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, RotateCcw, Copy, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { processNoteWithAI, type AIError } from '@/services/AIService';
import type { AIProviderConfig } from '@/hooks/useSettings';
import type { Note } from '@/types/note';
import type { Contact } from '@/types/contact';
import { formatLocalDate, parseLocalDate } from '@/utils/dateUtils';
import { CATEGORY_CONFIG } from '@/constants/notes';

interface AISummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: Note[];
  aiProvider: AIProviderConfig;
  noteAssigneesCache: Map<string, Contact[]>;
}

type DialogState = 'loading' | 'result' | 'error';

function formatTasksForAI(
  notes: Note[],
  noteAssigneesCache: Map<string, Contact[]>,
  t: (key: string) => string
): string {
  return notes
    .map((note, index) => {
      const parts: string[] = [];

      // Title with number
      parts.push(`${index + 1}. ${note.content}`);

      // Category
      if (CATEGORY_CONFIG[note.category].showCategoryInAISummary) {
        const categoryLabel = t(`categories.${note.category}`);
        parts.push(`   Tipo: ${categoryLabel}`);
      }

      // Deadline
      if (note.deadline) {
        const date = parseLocalDate(note.deadline);
        const formattedDate = formatLocalDate(date);
        parts.push(`   Fecha límite: ${formattedDate}`);
      }

      // Assignees
      const assignees = noteAssigneesCache.get(note.id) ?? [];
      if (assignees.length > 0) {
        const names = assignees.map((c) =>
          c.lastname ? `${c.name} ${c.lastname}` : c.name
        );
        parts.push(`   Asignado a: ${names.join(', ')}`);
      }

      return parts.join('\n');
    })
    .join('\n\n');
}

const SUMMARY_PROMPT = `Analiza las siguientes tareas y genera un resumen ejecutivo breve y estructurado:

1. **Estado general**: 1-2 oraciones describiendo el panorama de tareas
2. **Prioridades**: Tareas urgentes o con fechas límite próximas (si las hay)
3. **Distribución**: Breve mención de los tipos de tareas

Responde en el mismo idioma que las tareas. Sé conciso y útil. Usa formato Markdown.`;

export function AISummaryDialog({
  open,
  onOpenChange,
  notes,
  aiProvider,
  noteAssigneesCache,
}: AISummaryDialogProps) {
  const { t } = useTranslation();
  const [dialogState, setDialogState] = useState<DialogState>('loading');
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);

  const generateSummary = async () => {
    setDialogState('loading');
    setSummary('');

    const tasksContent = formatTasksForAI(notes, noteAssigneesCache, t);
    const fullContent = `${SUMMARY_PROMPT}\n\n---\n\nTareas:\n\n${tasksContent}`;

    try {
      const result = await processNoteWithAI({
        content: fullContent,
        prompt: 'Genera el resumen según las instrucciones.',
        provider: aiProvider.provider,
        model: aiProvider.model,
        apiKey: aiProvider.apiKey,
      });

      setSummary(result.generatedContent);
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

      setDialogState('error');
    }
  };

  useEffect(() => {
    if (open && notes.length > 0) {
      generateSummary();
    }
  }, [open]);

  const handleClose = () => {
    setDialogState('loading');
    setSummary('');
    setCopied(false);
    onOpenChange(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy summary:', err);
    }
  };

  const handleRegenerate = () => {
    generateSummary();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            {t('ai.summary.title')} ({notes.length})
          </DialogTitle>
        </DialogHeader>

        {dialogState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 flex-shrink-0">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <p className="text-muted-foreground">{t('ai.summary.generating')}</p>
          </div>
        )}

        {dialogState === 'result' && (
          <div className="rounded-md border border-border bg-[#FBFCFD] dark:bg-muted/30 overflow-y-auto max-h-[50vh]">
            <div className="p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{summary}</p>
            </div>
          </div>
        )}

        {dialogState === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4 flex-shrink-0">
            <X className="h-8 w-8 text-destructive" />
            <p className="text-muted-foreground">{t('ai.errors.processingFailed')}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 flex-shrink-0 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose}>
            {t('ai.summary.close')}
          </Button>

          {(dialogState === 'result' || dialogState === 'error') && (
            <Button variant="outline" onClick={handleRegenerate} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              {t('ai.summary.regenerate')}
            </Button>
          )}

          {dialogState === 'result' && (
            <Button onClick={handleCopy} className="bg-purple-600 hover:bg-purple-700 gap-1.5">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  {t('ai.summary.copied')}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {t('ai.summary.copy')}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
