import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNotes } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Share2, Check, X, Loader2 } from 'lucide-react';
import type { NoteCategory } from '@/types/note';

export default function ShareReceiver() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createNote } = useNotes();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get shared content from URL params (set by SendIntent listener)
  useEffect(() => {
    const sharedText = searchParams.get('text') || '';
    const sharedTitle = searchParams.get('title') || '';
    const sharedUrl = searchParams.get('url') || '';

    // Combine shared content
    let content = sharedTitle || '';
    let desc = sharedText || '';

    // If there's a URL, append it to the description
    if (sharedUrl) {
      desc = desc ? `${desc}\n\n${sharedUrl}` : sharedUrl;
    }

    // If no title but we have text, use first line as title
    if (!content && sharedText) {
      const lines = sharedText.split('\n');
      content = lines[0].slice(0, 100); // First line as title, max 100 chars
      desc = lines.slice(1).join('\n').trim(); // Rest as description
    }

    setTitle(content);
    setDescription(desc);
  }, [searchParams]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError(t('share.errorEmptyTitle'));
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const category: NoteCategory = 'todo';
      await createNote(title.trim(), category, description.trim() || null);
      navigate('/', { replace: true });
    } catch (err) {
      setError(t('share.errorCreating'));
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t('share.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              {t('share.taskTitle')}
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('share.taskTitlePlaceholder')}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              {t('share.description')}
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('share.descriptionPlaceholder')}
              rows={5}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            <X className="h-4 w-4 mr-2" />
            {t('cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            {t('share.createTask')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
