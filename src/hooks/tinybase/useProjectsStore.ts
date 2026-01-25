import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { Project, ProjectInput, ProjectStatus } from '@/types/project';
import { generateId, now } from '@/store/schema';

/**
 * TinyBase-based projects hook
 * Provides CRUD operations for projects
 */
export function useProjectsStore() {
  const { store, isReady } = useTinyBase();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load projects from TinyBase store
   */
  const loadProjects = useCallback(() => {
    if (!store || !isReady) return;

    const projectsTable = store.getTable('projects') || {};

    const projectsList: Project[] = Object.entries(projectsTable)
      .filter(([_, row]) => {
        // Filter out soft-deleted projects
        return !(row as Record<string, unknown>).deleted_at;
      })
      .map(([id, row]) => {
        const projectRow = row as Record<string, unknown>;
        return {
          id,
          name: projectRow.name as string,
          description: (projectRow.description as string) || null,
          color: (projectRow.color as string) || '#6b7280',
          icon: (projectRow.icon as string) || null,
          status: (projectRow.status as ProjectStatus) || 'active',
          sort_order: (projectRow.sort_order as number) || 0,
          created_at: projectRow.created_at as string,
          updated_at: projectRow.updated_at as string,
          deleted_at: (projectRow.deleted_at as string) || null,
          remote_id: (projectRow.remote_id as string) || null,
          sync_status: (projectRow.sync_status as Project['sync_status']) || 'local',
          last_synced_at: (projectRow.last_synced_at as string) || null,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

    setProjects(projectsList);
    setLoading(false);
  }, [store, isReady]);

  // Load projects when store is ready
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Listen to store changes
  useEffect(() => {
    if (!store) return;

    const listenerId = store.addTableListener('projects', () => {
      loadProjects();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [store, loadProjects]);

  /**
   * Create a new project
   */
  const createProject = useCallback(
    async (input: ProjectInput): Promise<Project> => {
      if (!store) throw new Error('Store not ready');

      const id = generateId();
      const timestamp = now();

      // Calculate next sort order
      const projectsTable = store.getTable('projects') || {};
      const maxSortOrder = Math.max(
        0,
        ...Object.values(projectsTable).map(
          (row) => ((row as Record<string, unknown>).sort_order as number) || 0
        )
      );

      const project: Project = {
        id,
        name: input.name,
        description: input.description || null,
        color: input.color || '#6b7280',
        icon: input.icon || null,
        status: input.status || 'active',
        sort_order: maxSortOrder + 1,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      };

      store.setRow('projects', id, {
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
        status: project.status,
        sort_order: project.sort_order,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      toast.success(t('projects.projectCreated', 'Project created'));
      return project;
    },
    [store, t]
  );

  /**
   * Update a project
   */
  const updateProject = useCallback(
    async (id: string, input: Partial<ProjectInput>): Promise<Project> => {
      if (!store) throw new Error('Store not ready');

      const timestamp = now();
      const existingRow = store.getRow('projects', id) as Record<string, unknown> | undefined;

      if (!existingRow) {
        throw new Error('Project not found');
      }

      const updates: Record<string, unknown> = {
        updated_at: timestamp,
        sync_status: 'pending',
      };

      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.color !== undefined) updates.color = input.color;
      if (input.icon !== undefined) updates.icon = input.icon;
      if (input.status !== undefined) updates.status = input.status;

      store.setPartialRow('projects', id, updates as Record<string, string | number | boolean | null>);

      toast.success(t('projects.projectUpdated', 'Project updated'));

      return {
        id,
        name: (updates.name as string) || (existingRow.name as string),
        description: ((updates.description as string) ?? existingRow.description) as string | null,
        color: (updates.color as string) || (existingRow.color as string),
        icon: ((updates.icon as string) ?? existingRow.icon) as string | null,
        status: (updates.status as ProjectStatus) || (existingRow.status as ProjectStatus),
        sort_order: existingRow.sort_order as number,
        created_at: existingRow.created_at as string,
        updated_at: timestamp,
        deleted_at: null,
      };
    },
    [store, t]
  );

  /**
   * Delete a project (soft delete)
   * Notes with this project_id will be set to null
   */
  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const timestamp = now();

      // Soft delete the project
      store.setPartialRow('projects', id, {
        deleted_at: timestamp,
        updated_at: timestamp,
        sync_status: 'pending',
      });

      // Remove project association from all notes
      const notesTable = store.getTable('notes') || {};
      for (const [noteId, row] of Object.entries(notesTable)) {
        if ((row as Record<string, unknown>).project_id === id) {
          store.setPartialRow('notes', noteId, {
            project_id: null,
            updated_at: timestamp,
            sync_status: 'pending',
          });
        }
      }

      toast.success(t('projects.projectDeleted', 'Project deleted'));
    },
    [store, t]
  );

  /**
   * Archive a project
   */
  const archiveProject = useCallback(
    async (id: string): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const timestamp = now();

      store.setPartialRow('projects', id, {
        status: 'archived',
        updated_at: timestamp,
        sync_status: 'pending',
      });

      toast.success(t('projects.projectArchived', 'Project archived'));
    },
    [store, t]
  );

  /**
   * Get active projects only
   */
  const getActiveProjects = useCallback((): Project[] => {
    return projects.filter((p) => p.status === 'active');
  }, [projects]);

  /**
   * Get project by ID
   */
  const getProject = useCallback(
    (id: string): Project | undefined => {
      return projects.find((p) => p.id === id);
    },
    [projects]
  );

  /**
   * Get notes count for a project
   */
  const getNotesCountForProject = useCallback(
    (projectId: string): number => {
      if (!store || !isReady) return 0;

      const notesTable = store.getTable('notes') || {};
      return Object.values(notesTable).filter(
        (row) =>
          (row as Record<string, unknown>).project_id === projectId &&
          !(row as Record<string, unknown>).deleted_at
      ).length;
    },
    [store, isReady]
  );

  return {
    projects,
    loading,
    createProject,
    updateProject,
    deleteProject,
    archiveProject,
    getActiveProjects,
    getProject,
    getNotesCountForProject,
  };
}
