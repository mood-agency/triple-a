import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Plus, FolderKanban } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useActiveProject } from '@/contexts/ProjectContext';

interface ProjectSelectorProps {
  className?: string;
  collapsed?: boolean;
}

export function ProjectSelector({ className, collapsed = false }: ProjectSelectorProps) {
  const { t } = useTranslation();
  const { activeProject, activeProjectId, projects, setActiveProjectId, createProject } = useActiveProject();
  const [open, setOpen] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const activeProjects = projects.filter(p => p.status === 'active');

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreating(true);
    try {
      await createProject(newProjectName.trim(), true);
      setNewProjectName('');
      setShowNewProjectDialog(false);
    } finally {
      setIsCreating(false);
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
    </>
  );
}
