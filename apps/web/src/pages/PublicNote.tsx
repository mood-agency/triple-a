import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, AlertTriangle, User } from 'lucide-react';

interface PublicNote {
  public_slug: string;
  content: string;
  description: string | null;
  category: 'todo' | 'followup' | 'notes' | 'meeting';
  deadline: string | null;
  created_at: string;
  labels: { name: string; color: string }[];
  assignees: string[];
}

// Helper to render description (could be TipTap JSON or plain text)
function renderDescription(description: string) {
  try {
    const parsed = JSON.parse(description);
    // If it's TipTap JSON, extract plain text
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (node.text) return node.text;
      if (node.content) return node.content.map(extractText).join('\n');
      return '';
    };
    return <p className="whitespace-pre-wrap">{extractText(parsed)}</p>;
  } catch {
    return <p className="whitespace-pre-wrap">{description}</p>;
  }
}

export function PublicNote() {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const [note, setNote] = useState<PublicNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNote() {
      try {
        const apiBase = import.meta.env.VITE_API_URL || '';
        const response = await fetch(`${apiBase}/api/public/notes/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('not_found');
          } else {
            setError('server_error');
          }
          return;
        }
        const { data } = await response.json();
        setNote(data);
      } catch {
        setError('network_error');
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchNote();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">{t('sharing.noteNotFound')}</h2>
            <p className="text-sm text-muted-foreground">{t('sharing.noteNotFoundDescription')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the public note
  return (
    <div className="min-h-screen bg-background p-4 flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="outline">
              {note.category === 'todo' && t('categoryTodo')}
              {note.category === 'followup' && t('categoryFollowUp')}
              {note.category === 'notes' && t('categoryNote')}
              {note.category === 'meeting' && t('categoryMeeting')}
            </Badge>
            {note.labels.map((label, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded-full text-white"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
          <CardTitle className="text-xl">{note.content}</CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(note.created_at).toLocaleDateString(i18n.language)}
            </span>
            {note.deadline && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(note.deadline).toLocaleDateString(i18n.language)}
              </span>
            )}
            {note.assignees && note.assignees.length > 0 && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {note.assignees.join(', ')}
              </span>
            )}
          </div>
        </CardHeader>
        {note.description && (
          <CardContent>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              {renderDescription(note.description)}
            </div>
          </CardContent>
        )}
        <div className="border-t px-6 py-3 text-xs text-muted-foreground text-center">
          {t('sharing.poweredBy')}
        </div>
      </Card>
    </div>
  );
}
