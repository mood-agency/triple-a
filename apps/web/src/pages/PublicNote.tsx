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

// Helper to render description (could be BlockNote JSON, TipTap JSON, or plain text)
function renderDescription(description: string) {
  try {
    const parsed = JSON.parse(description);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (node.text) return node.text;

      // Handle BlockNote format: array of blocks with content arrays
      if (Array.isArray(node)) {
        return node.map(extractText).filter(Boolean).join('\n');
      }

      // BlockNote block: { type: "paragraph", content: [{ type: "text", text: "..." }] }
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join('');
      }

      return '';
    };

    const text = extractText(parsed);
    return <p className="whitespace-pre-wrap">{text}</p>;
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
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
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
    <div className="h-screen bg-background py-8 px-4 flex justify-center items-start">
      <Card className="w-full max-w-2xl max-h-[calc(100vh-4rem)] flex flex-col">
        <CardHeader className="flex-shrink-0">
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
        <div className="flex-1 overflow-y-auto px-6">
          {note.description && (
            <div className="prose prose-sm max-w-none text-muted-foreground pb-4">
              {renderDescription(note.description)}
            </div>
          )}
        </div>
        <div className="border-t px-6 py-3 text-xs text-muted-foreground text-center flex-shrink-0">
          {t('sharing.poweredBy')}
        </div>
      </Card>
    </div>
  );
}
