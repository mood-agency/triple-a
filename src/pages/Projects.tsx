import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Header } from '@/components/Header';
import { ColorPicker } from '@/components/ui/color-picker';
import { Plus, Search, Trash2, FolderKanban, Archive } from 'lucide-react';
import type { Project } from '@/types/project';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface OutletContext {
  sidebarTrigger: React.ReactNode;
}

export function Projects() {
  const { t } = useTranslation();
  const { sidebarTrigger } = useOutletContext<OutletContext>();
  const { projects, createProject, updateProject, deleteProject, archiveProject, getNotesCountForProject } = useProjects();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#6b7280');
  const [formIcon, setFormIcon] = useState('');

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormColor(project.color);
    setFormIcon(project.icon || '');
    setIsCreating(false);
  };

  const handleStartCreate = () => {
    setSelectedProject(null);
    setFormName('');
    setFormDescription('');
    setFormColor('#6b7280');
    setFormIcon('');
    setIsCreating(true);
  };

  const handleCancel = () => {
    setSelectedProject(null);
    setIsCreating(false);
    setFormName('');
    setFormDescription('');
    setFormColor('#6b7280');
    setFormIcon('');
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    try {
      if (isCreating) {
        await createProject({
          name: formName.trim(),
          description: formDescription.trim() || null,
          color: formColor,
          icon: formIcon.trim() || null,
        });
      } else if (selectedProject) {
        await updateProject(selectedProject.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          color: formColor,
          icon: formIcon.trim() || null,
        });
      }
      handleCancel();
    } catch (error) {
      console.error('Error saving project:', error);
    }
  };

  const handleDelete = async () => {
    if (!selectedProject) return;

    try {
      await deleteProject(selectedProject.id);
      handleCancel();
    } catch (error) {
      console.error('Error deleting project:', error);
    }
    setShowDeleteConfirm(false);
  };

  const handleArchive = async () => {
    if (!selectedProject) return;

    try {
      await archiveProject(selectedProject.id);
      handleCancel();
    } catch (error) {
      console.error('Error archiving project:', error);
    }
  };

  const isEditing = selectedProject !== null || isCreating;

  return (
    <>
      <Header>
        {sidebarTrigger}
        <Button onClick={handleStartCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('projects.addProject', 'Add Project')}
        </Button>
      </Header>

      <div className="flex flex-1 gap-6 min-h-0">
        {/* Left panel - Projects list */}
        <div className="w-80 flex flex-col border-r border-border pr-6">
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('projects.searchProjects', 'Search projects...')}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('projects.allProjects', 'All projects')}</SelectItem>
                <SelectItem value="active">{t('projects.active', 'Active')}</SelectItem>
                <SelectItem value="archived">{t('projects.archived', 'Archived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? t('projects.noProjectsFound', 'No projects found') : t('projects.noProjects', 'No projects yet')}
              </p>
            ) : (
              filteredProjects.map((project) => {
                const notesCount = getNotesCountForProject(project.id);
                return (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => handleSelectProject(project)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                      selectedProject?.id === project.id
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-xs"
                      style={{ backgroundColor: project.color }}
                    >
                      {project.icon || ''}
                    </span>
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium block">{project.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('projects.notesCount', '{{count}} tasks', { count: notesCount })}
                      </span>
                    </div>
                    {project.status === 'archived' && (
                      <Archive className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel - Edit form */}
        <div className="flex-1 flex flex-col min-h-0">
          {isEditing ? (
            <div className="max-w-md">
              <h2 className="text-lg font-semibold mb-6">
                {isCreating ? t('projects.addProject', 'Add Project') : t('projects.editProject', 'Edit Project')}
              </h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('projects.name', 'Name')}</label>
                  <Input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('projects.name', 'Name')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && formName.trim()) {
                        handleSave();
                      }
                    }}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('projects.description', 'Description')}</label>
                  <Textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder={t('projects.description', 'Description')}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('projects.icon', 'Icon')} (emoji)</label>
                  <Input
                    type="text"
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    placeholder="📁"
                    maxLength={2}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('projects.color', 'Color')}</label>
                  <ColorPicker color={formColor} onChange={setFormColor} />
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Preview</label>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                    <span
                      className="w-6 h-6 rounded flex items-center justify-center text-sm"
                      style={{ backgroundColor: formColor }}
                    >
                      {formIcon || ''}
                    </span>
                    <span className="text-sm font-medium">
                      {formName || t('projects.name', 'Name')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  {!isCreating && selectedProject && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleArchive}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        {t('projects.archive', 'Archive')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('delete')}
                      </Button>
                    </div>
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
              <FolderKanban className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">{t('projects.selectProjectToEdit', 'Select a project to edit')}</p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteProject', 'Delete Project')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('projects.confirmDelete', 'This action cannot be undone. All tasks in this project will become unassigned.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedProject && (
            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-md">
              <span
                className="w-6 h-6 rounded flex items-center justify-center text-sm"
                style={{ backgroundColor: selectedProject.color }}
              >
                {selectedProject.icon || ''}
              </span>
              <span className="text-sm font-medium">{selectedProject.name}</span>
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
