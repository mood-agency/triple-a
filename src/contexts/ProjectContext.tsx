import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useSettings } from '@/hooks/useSettings';
import type { Project } from '@/types/project';

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
  createProject: (name: string, setAsActive?: boolean) => Promise<Project>;
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

  // Sync active project with URL and Settings
  useEffect(() => {
    if (projectsLoading) return;

    const projectParam = searchParams.get('project');
    const activeProjects = projects.filter(p => p.status === 'active');

    // If we have a URL param, prioritize it (if valid)
    if (projectParam) {
      const isValidProject = projects.some(p => p.id === projectParam);
      if (isValidProject) {
        if (activeProjectId !== projectParam) {
          setActiveProjectIdState(projectParam);
          // Also sync settings just in case
          if (settings.activeProjectId !== projectParam) {
            updateSettings({ activeProjectId: projectParam });
          }
        }
        if (!initialized) {
          setInitialized(true);
        }
        return;
      }
    }

    // Initialization logic (only runs once if URL param provided, or until we find a default)
    if (!initialized) {
      if (settings.activeProjectId && activeProjects.some(p => p.id === settings.activeProjectId)) {
        // Use saved project if it exists and is active
        setActiveProjectIdState(settings.activeProjectId);
        // Sync to URL
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.set('project', settings.activeProjectId!);
          return newParams;
        }, { replace: true });
      } else if (activeProjects.length > 0) {
        // Use first active project as default
        const defaultId = activeProjects[0].id;
        setActiveProjectIdState(defaultId);
        updateSettings({ activeProjectId: defaultId });
        // Sync to URL
        setSearchParams(prev => {
          const newParams = new URLSearchParams(prev);
          newParams.set('project', defaultId);
          return newParams;
        }, { replace: true });
      }
      setInitialized(true);
    }
  }, [projects, projectsLoading, settings.activeProjectId, updateSettings, initialized, searchParams, setSearchParams, activeProjectId]);

  // Set active project and persist to settings AND URL
  const setActiveProjectId = useCallback((id: string) => {
    setActiveProjectIdState(id);
    updateSettings({ activeProjectId: id });
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('project', id);
      return newParams;
    }, { replace: true });
  }, [updateSettings, setSearchParams]);

  // Get the active project object
  const activeProject = useMemo(() => {
    if (!activeProjectId) return null;
    return projects.find(p => p.id === activeProjectId) || null;
  }, [activeProjectId, projects]);

  // Create project wrapper that can set as active
  const createProject = useCallback(async (name: string, setAsActive = true): Promise<Project> => {
    const newProject = await createProjectBase({ name });
    if (setAsActive) {
      setActiveProjectId(newProject.id);
    }
    return newProject;
  }, [createProjectBase, setActiveProjectId]);

  const value = useMemo(() => ({
    activeProject,
    activeProjectId,
    projects,
    loading: projectsLoading || !initialized,
    setActiveProjectId,
    createProject,
  }), [activeProject, activeProjectId, projects, projectsLoading, initialized, setActiveProjectId, createProject]);

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
