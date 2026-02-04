import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Plus, FolderKanban, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ColorPicker } from '@/components/ui/color-picker';
import { useActiveProject } from '@/contexts/ProjectContext';
import type { Project } from '@/types/project';

interface ProjectSelectorProps {
  className?: string;
  collapsed?: boolean;
}

export function ProjectSelector({ className, collapsed = false }: ProjectSelectorProps) {
  const { t } = useTranslation();
  const { activeProject, activeProjectId, projects, setActiveProjectId, createProject, updateProject, deleteProject } = useActiveProject();
  const [open, setOpen] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit project state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#6b7280');
  const [editIcon, setEditIcon] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const activeProjects = projects.filter(p => p.status === 'active');

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      await createProject({ name: newProjectName.trim() }, true);
      setNewProjectName('');
      setShowNewProjectDialog(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || '');
    setEditColor(project.color);
    setEditIcon(project.icon || '');
    setOpen(false);
  };

  const handleSaveEdit = async () => {
    if (!editingProject || !editName.trim()) return;

    setIsSaving(true);
    try {
      await updateProject(editingProject.id, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        color: editColor,
        icon: editIcon.trim() || null,
      });
      setEditingProject(null);
    } catch (error) {
      console.error('Error updating project:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!editingProject) return;

    try {
      const deletedId = editingProject.id;
      await deleteProject(deletedId);
      setShowDeleteConfirm(false);
      setEditingProject(null);
      // If the deleted project was active, switch to the first available project
      if (activeProjectId === deletedId) {
        const remaining = activeProjects.filter(p => p.id !== deletedId);
        if (remaining.length > 0) {
          setActiveProjectId(remaining[0].id);
        }
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  if (collapsed) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9', className)}
            style={activeProject ? { color: activeProject.color } : undefined}
          >
            {activeProject?.icon ? (
              <span className="text-lg">{activeProject.icon}</span>
            ) : (
              <FolderKanban className="h-5 w-5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('projects.searchProjects')} />
            <CommandList>
              <CommandEmpty>{t('projects.noProjectsFound')}</CommandEmpty>
              <CommandGroup>
                {activeProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.name}
                    onSelect={() => {
                      setActiveProjectId(project.id);
                      setOpen(false);
                    }}
                  >
                    <div
                      className="mr-2 h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.icon && <span className="mr-1">{project.icon}</span>}
                    <span className="flex-1 truncate">{project.name}</span>
                    {activeProjectId === project.id && (
                      <Check className="h-4 w-4 ml-2" />
                    )}
                    <button
                      type="button"
                      className="ml-1 p-0.5 rounded opacity-0 group-data-[selected=true]:opacity-50 hover:!opacity-100 hover:bg-muted transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(project);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setShowNewProjectDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('projects.addProject')}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn('w-full justify-between', className)}
          >
            <div className="flex items-center gap-2 truncate">
              {activeProject ? (
                <>
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: activeProject.color }}
                  />
                  {activeProject.icon && <span>{activeProject.icon}</span>}
                  <span className="truncate">{activeProject.name}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{t('projects.selectProject')}</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('projects.searchProjects')} />
            <CommandList>
              <CommandEmpty>{t('projects.noProjectsFound')}</CommandEmpty>
              <CommandGroup>
                {activeProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.name}
                    onSelect={() => {
                      setActiveProjectId(project.id);
                      setOpen(false);
                    }}
                  >
                    <div
                      className="mr-2 h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    {project.icon && <span className="mr-1">{project.icon}</span>}
                    <span className="flex-1 truncate">{project.name}</span>
                    {activeProjectId === project.id && (
                      <Check className="h-4 w-4 ml-2" />
                    )}
                    <button
                      type="button"
                      className="ml-1 p-0.5 rounded opacity-0 group-data-[selected=true]:opacity-50 hover:!opacity-100 hover:bg-muted transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(project);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setShowNewProjectDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('projects.addProject')}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('projects.addProject')}</DialogTitle>
            <DialogDescription>
              {t('projects.addProjectDescription', 'Create a new project to organize your tasks.')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">{t('projects.name')}</Label>
              <Input
                id="project-name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder={t('projects.namePlaceholder', 'My Project')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProjectName.trim()) {
                    handleCreateProject();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewProjectDialog(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || isCreating}
            >
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('projects.editProject')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('projects.name')}</Label>
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t('projects.name')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editName.trim()) {
                    handleSaveEdit();
                  }
                }}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>{t('projects.description')}</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('projects.description')}
                rows={2}
              />
            </div>

            {/* Icon and Color in same row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('projects.icon')} (emoji)</Label>
                <Input
                  type="text"
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  placeholder="📁"
                  maxLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label>{t('projects.color')}</Label>
                <ColorPicker color={editColor} onChange={setEditColor} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex !justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingProject(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editName.trim() || isSaving}>
                {t('save')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteProject')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('projects.confirmDelete')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {editingProject && (
            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-md">
              <span
                className="w-6 h-6 rounded flex items-center justify-center text-sm"
                style={{ backgroundColor: editingProject.color }}
              >
                {editingProject.icon || ''}
              </span>
              <span className="text-sm font-medium">{editingProject.name}</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
