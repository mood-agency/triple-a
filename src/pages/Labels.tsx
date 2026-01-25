import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useLabels } from '@/hooks/useLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Header } from '@/components/Header';
import { ColorPicker } from '@/components/ui/color-picker';
import { Plus, Search, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import type { Label } from '@/types/note';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OutletContext {
  sidebarTrigger: React.ReactNode;
}

export function Labels() {
  const { t } = useTranslation();
  const { sidebarTrigger } = useOutletContext<OutletContext>();
  const { labels, createLabel, updateLabel, deleteLabel } = useLabels();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#6b7280');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filteredLabels = labels.filter((label) =>
    label.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectLabel = (label: Label) => {
    setSelectedLabel(label);
    setFormName(label.name);
    setFormColor(label.color);
    setIsCreating(false);
  };

  const handleStartCreate = () => {
    setSelectedLabel(null);
    setFormName('');
    setFormColor('#6b7280');
    setIsCreating(true);
  };

  const handleCancel = () => {
    setSelectedLabel(null);
    setIsCreating(false);
    setFormName('');
    setFormColor('#6b7280');
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    try {
      if (isCreating) {
        await createLabel(formName.trim(), formColor);
        toast.success(t('toast.labelCreated'));
      } else if (selectedLabel) {
        await updateLabel(selectedLabel.id, formName.trim(), formColor);
        toast.success(t('toast.labelUpdated'));
      }
      handleCancel();
    } catch (error) {
      console.error('Error saving label:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedLabel) return;

    try {
      await deleteLabel(selectedLabel.id);
      toast.success(t('toast.labelDeleted'));
      handleCancel();
    } catch (error) {
      console.error('Error deleting label:', error);
    }
    setShowDeleteConfirm(false);
  };

  const isEditing = selectedLabel !== null || isCreating;

  return (
    <>
      <Header>
        {sidebarTrigger}
        <Button onClick={handleStartCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('createLabel')}
        </Button>
      </Header>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left panel - Labels list */}
        <div className="w-80 flex flex-col border-r border-border pr-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchLabels')}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredLabels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? t('noLabelsFound') : t('noLabels')}
              </p>
            ) : (
              filteredLabels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => handleSelectLabel(label)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                    selectedLabel?.id === label.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 text-left text-sm font-medium">{label.name}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Edit form */}
        <div className="flex-1 flex flex-col min-h-0">
          {isEditing ? (
            <div className="max-w-md">
              <h2 className="text-lg font-semibold mb-6">
                {isCreating ? t('createLabel') : t('editLabel')}
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('newLabelName')}</label>
                  <Input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('newLabelName')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formName.trim()) {
                        handleSave();
                      }
                    }}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('labelColor')}</label>
                  <ColorPicker color={formColor} onChange={setFormColor} />
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Preview</label>
                  <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                    <span
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: formColor }}
                    />
                    <span className="text-sm font-medium">
                      {formName || t('newLabelName')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  {!isCreating && selectedLabel && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('delete')}
                    </Button>
                  )}
                  <div className={`flex gap-2 ${isCreating ? 'ml-auto' : ''}`}>
                    <Button variant="outline" onClick={handleCancel}>
                      {t('cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={!formName.trim()}>
                      {isCreating ? t('create') : t('save')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Tag className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">{t('selectLabelToEdit')}</p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteLabel')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('confirmDeleteLabel')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedLabel && (
            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-md">
              <span
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: selectedLabel.color }}
              />
              <span className="text-sm font-medium">{selectedLabel.name}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
