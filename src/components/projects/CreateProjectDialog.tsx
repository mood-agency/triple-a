import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ColorPicker } from '@/components/ui/color-picker';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateProject: (data: {
    name: string;
    description: string | null;
    icon: string | null;
    color: string;
  }) => Promise<void>;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreateProject,
}: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#6b7280');
  const [isCreating, setIsCreating] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setIcon('');
      setColor('#6b7280');
      setIsCreating(false);
    }
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await onCreateProject({
        name: name.trim(),
        description: description.trim() || null,
        icon: icon.trim() || null,
        color,
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('projects.addProject')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Preview */}
          <div className="flex items-center gap-2.5 p-2.5 bg-muted/50 rounded-md">
            <span
              className="w-5 h-5 rounded flex items-center justify-center text-xs shrink-0"
              style={{ backgroundColor: color }}
            >
              {icon || ''}
            </span>
            <span className="text-sm font-medium truncate">
              {name || t('projects.name')}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('projects.name')}</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projects.name')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) {
                  handleCreate();
                }
              }}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('projects.description')}</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('projects.description')}
              rows={2}
            />
          </div>

          {/* Icon and Color in same row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('projects.icon')} (emoji)</label>
              <Input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="📁"
                maxLength={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('projects.color')}</label>
              <ColorPicker color={color} onChange={setColor} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
