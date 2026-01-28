import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import type { Project, ProjectInput } from '@/types/project';

interface ProjectContextValue {
  /** Currently active project */
  activeProject: Project | null;
  /** ID of the active project */
  activeProjectId: string | null;
  /** All available projects */
  projects: Project[];
  /** Loading state */
  loading: boolean;
  /** Set the active project by ID */
  setActiveProjectId: (id: string) => void;
  /** Create a new project and optionally set it as active */
  createProject: (input: ProjectInput, setAsActive?: boolean) => Promise<Project>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const { projects, loading: projectsLoading, createProject: createProjectBase } = useProjects();
  const { settings, updateSettings } = useSettings();
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract project param - URL is the source of truth when valid
  const projectParam = searchParams.get('project');

  // Compute the effective active project ID synchronously
  // Priority: valid URL param > internal state > settings > first project
  const effectiveActiveProjectId = useMemo(() => {
    if (projectsLoading) return activeProjectId;

    // If URL param is valid, use it immediately (no waiting for useEffect)
    if (projectParam && projects.some(p => p.id === projectParam)) {
      return projectParam;
    }

    // Fall back to internal state if set
    if (activeProjectId && projects.some(p => p.id === activeProjectId)) {
      return activeProjectId;
    }

    // Fall back to settings
    const activeProjects = projects.filter(p => p.status === 'active');
    if (settings.activeProjectId && activeProjects.some(p => p.id === settings.activeProjectId)) {
      return settings.activeProjectId;
    }

    // Fall back to first active project
    if (activeProjects.length > 0) {
      return activeProjects[0].id;
    }

    return null;
  }, [projectParam, projects, projectsLoading, activeProjectId, settings.activeProjectId]);

  // Sync internal state and settings with URL (side effects only)
  useEffect(() => {
    if (projectsLoading) return;

    const activeProjects = projects.filter(p => p.status === 'active');

    // If we have a valid URL param, sync internal state and settings
    if (projectParam && projects.some(p => p.id === projectParam)) {
      if (activeProjectId !== projectParam) {
        setActiveProjectIdState(projectParam);
      }
      if (settings.activeProjectId !== projectParam) {
        updateSettings({ activeProjectId: projectParam });
      }
      if (!initialized) {
        setInitialized(true);
      }
      return;
    }

    // Initialization logic (only runs once)
    if (!initialized) {
      if (settings.activeProjectId && activeProjects.some(p => p.id === settings.activeProjectId)) {
        setActiveProjectIdState(settings.activeProjectId);
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.set('project', settings.activeProjectId!);
          return newParams;
        }, { replace: true });
      } else if (activeProjects.length > 0) {
        const defaultId = activeProjects[0].id;
        setActiveProjectIdState(defaultId);
        updateSettings({ activeProjectId: defaultId });
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.set('project', defaultId);
          return newParams;
        }, { replace: true });
      }
      setInitialized(true);
    }
  }, [projects, projectsLoading, settings.activeProjectId, updateSettings, initialized, projectParam, setSearchParams, activeProjectId]);

  // Set active project and persist to settings AND URL
  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    updateSettings({ activeProjectId: id });
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('project', id);
      // Clear note selection when switching projects as the note ID belongs to the previous project
      newParams.delete('note');
      return newParams;
    }, { replace: true });
  }, [updateSettings, setSearchParams]);

  // Get the active project object
  const activeProject = useMemo(() => {
    if (!effectiveActiveProjectId) return null;
    return projects.find(p => p.id === effectiveActiveProjectId) || null;
  }, [effectiveActiveProjectId, projects]);

  // Create project wrapper that can set as active
  const createProject = useCallback(async (input: ProjectInput, setAsActive = true): Promise<Project> => {
    const newProject = await createProjectBase(input);
    if (setAsActive) {
      setActiveProjectId(newProject.id);
    }
    return newProject;
  }, [createProjectBase, setActiveProjectId]);

  const value = useMemo(() => ({
    activeProject,
    activeProjectId: effectiveActiveProjectId,
    projects,
    loading: projectsLoading || !initialized,
    setActiveProjectId,
    createProject,
  }), [activeProject, effectiveActiveProjectId, projects, projectsLoading, initialized, setActiveProjectId, createProject]);

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useActiveProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useActiveProject must be used within a ProjectProvider');
  }
  return context;
}
