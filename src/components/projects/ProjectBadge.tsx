import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';

interface ProjectBadgeProps {
  project: Project;
  size?: 'sm' | 'md';
  showName?: boolean;
  className?: string;
}

export function ProjectBadge({
  project,
  size = 'sm',
  showName = true,
  className,
}: ProjectBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium',
        size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1',
        className
      )}
      style={{
        backgroundColor: `${project.color}20`,
        color: project.color,
      }}
    >
      {project.icon && (
        <span className={size === 'sm' ? 'text-[10px]' : 'text-xs'}>
          {project.icon}
        </span>
      )}
      {showName && <span className="truncate max-w-24">{project.name}</span>}
    </span>
  );
}
