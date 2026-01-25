import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, FolderKanban, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Project } from '@/types/project';

interface ProjectPickerProps {
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideIcon?: boolean;
}

export function ProjectPicker({
  projects,
  value,
  onChange,
  disabled = false,
  compact = false,
  className,
  open: controlledOpen,
  onOpenChange,
  hideIcon = false,
}: ProjectPickerProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);

  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  // Filter to show only active projects
  const activeProjects = projects.filter((p) => p.status === 'active');

  const selectedProject = projects.find((p) => p.id === value);

  const handleSelect = (projectId: string) => {
    onChange(projectId === value ? null : projectId);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'justify-between',
            compact ? 'h-7 px-2 text-xs' : 'h-9 px-3',
            !selectedProject && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {!hideIcon && (
              selectedProject ? (
                <span
                  className={cn('rounded shrink-0 flex items-center justify-center', compact ? 'w-3 h-3 text-[8px]' : 'w-4 h-4 text-[10px]')}
                  style={{ backgroundColor: selectedProject.color }}
                >
                  {selectedProject.icon || ''}
                </span>
              ) : (
                <FolderKanban className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-4 w-4')} />
              )
            )}
            <span className="truncate">
              {selectedProject?.name || t('projects.selectProject', 'Select project')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {selectedProject && (
              <X
                className={cn(
                  'shrink-0 opacity-50 hover:opacity-100',
                  compact ? 'h-3 w-3' : 'h-4 w-4'
                )}
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown
              className={cn('shrink-0 opacity-50', compact ? 'h-3 w-3' : 'h-4 w-4')}
            />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('projects.searchProjects', 'Search projects...')} />
          <CommandList>
            <CommandEmpty>
              <span className="text-muted-foreground">
                {t('projects.noProjectsFound', 'No projects found')}
              </span>
            </CommandEmpty>
            <CommandGroup>
              {activeProjects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  onSelect={() => handleSelect(project.id)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[10px]"
                      style={{ backgroundColor: project.color }}
                    >
                      {project.icon || ''}
                    </span>
                    <span className="truncate">{project.name}</span>
                  </div>
                  {value === project.id && <Check className="h-4 w-4 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
