import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Project, ProjectInput, ProjectStatus } from '@/types/project';

/**
 * Supabase-direct projects hook for 'supabase-only' mode
 * Provides the same API as useProjectsStore but queries Supabase directly
 */
export function useProjectsSupabase() {
  const { user } = useAuth();
  const userId = user?.id;
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  // Ref to always hold the latest fetchProjects — avoids re-subscribing realtime on fetch changes
  const fetchProjectsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  /**
   * Fetch projects from Supabase
   */
  const fetchProjects = useCallback(async () => {
    if (!userId || !supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sort_order')
      .order('name');

    if (error) {
      console.error('[useProjectsSupabase] Fetch error:', error);
      setLoading(false);
      return;
    }

    const projectsList: Project[] = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || null,
      color: row.color || '#6b7280',
      icon: row.icon || null,
      status: (row.status as ProjectStatus) || 'active',
      sort_order: row.sort_order || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: null,
      gcal_calendar_id: row.gcal_calendar_id || null,
      gcal_account_id: row.gcal_account_id || null,
      remote_id: row.id,
      sync_status: 'synced' as const,
      last_synced_at: row.updated_at,
    }));

    setProjects(projectsList);
    setLoading(false);
  }, [userId]);

  // Keep ref in sync so realtime handlers always call the latest version
  fetchProjectsRef.current = fetchProjects;

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Realtime subscription
  // Uses fetchProjectsRef so subscription doesn't need to be torn down on fetch fn change
  useEffect(() => {
    if (!userId || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`projects-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'projects',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchProjectsRef.current()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  /**
   * Create a new project
   */
  const createProject = useCallback(
    async (input: ProjectInput): Promise<Project> => {
      if (!userId || !supabase) throw new Error('Not authenticated');

      // Get max sort_order
      const maxSortOrder = projects.reduce((max, p) => Math.max(max, p.sort_order || 0), 0);

      const { data, error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          name: input.name,
          description: input.description || null,
          color: input.color || '#6b7280',
          icon: input.icon || null,
          status: input.status || 'active',
          sort_order: maxSortOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(t('projects.projectCreated', 'Project created'));

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        status: data.status as ProjectStatus,
        sort_order: data.sort_order,
        created_at: data.created_at,
        updated_at: data.updated_at,
        deleted_at: null,
        gcal_calendar_id: data.gcal_calendar_id,
        gcal_account_id: data.gcal_account_id,
        remote_id: data.id,
        sync_status: 'synced',
      };
    },
    [userId, projects, t]
  );

  /**
   * Update a project
   */
  const updateProject = useCallback(
    async (id: string, input: Partial<ProjectInput>): Promise<Project> => {
      if (!supabase) throw new Error('Supabase not configured');

      const updates: Record<string, unknown> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.color !== undefined) updates.color = input.color;
      if (input.icon !== undefined) updates.icon = input.icon;
      if (input.status !== undefined) updates.status = input.status;

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      toast.success(t('projects.projectUpdated', 'Project updated'));

      return {
        id: data.id,
        name: data.name,
        description: data.description,
        color: data.color,
        icon: data.icon,
        status: data.status as ProjectStatus,
        sort_order: data.sort_order,
        created_at: data.created_at,
        updated_at: data.updated_at,
        deleted_at: null,
        gcal_calendar_id: data.gcal_calendar_id,
        gcal_account_id: data.gcal_account_id,
        remote_id: data.id,
        sync_status: 'synced',
      };
    },
    [t]
  );

  /**
   * Update project's Google Calendar settings
   */
  const updateProjectCalendar = useCallback(
    async (id: string, gcalCalendarId: string | null, gcalAccountId: string | null = null): Promise<void> => {
      if (!supabase) return;

      const { error } = await supabase
        .from('projects')
        .update({
          gcal_calendar_id: gcalCalendarId,
          gcal_account_id: gcalAccountId,
        })
        .eq('id', id);

      if (error) console.error('[useProjectsSupabase] Update calendar error:', error);
    },
    []
  );

  /**
   * Delete a project (soft delete)
   */
  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      if (!supabase) throw new Error('Supabase not configured');

      // Soft delete project
      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Remove project from all notes
      await supabase.from('notes').update({ project_id: null }).eq('project_id', id);

      toast.success(t('projects.projectDeleted', 'Project deleted'));
    },
    [t]
  );

  /**
   * Archive a project
   */
  const archiveProject = useCallback(
    async (id: string): Promise<void> => {
      if (!supabase) throw new Error('Supabase not configured');

      const { error } = await supabase.from('projects').update({ status: 'archived' }).eq('id', id);

      if (error) throw error;

      toast.success(t('projects.projectArchived', 'Project archived'));
    },
    [t]
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
   * Note: This is async in Supabase mode, but we return 0 for now
   * Components should handle this separately
   */
  const getNotesCountForProject = useCallback((_projectId: string): number => {
    // For synchronous compatibility, return 0
    // Components needing this should fetch it separately
    return 0;
  }, []);

  return {
    projects,
    loading,
    createProject,
    updateProject,
    updateProjectCalendar,
    deleteProject,
    archiveProject,
    getActiveProjects,
    getProject,
    getNotesCountForProject,
  };
}
