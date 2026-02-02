import { useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Project, ProjectInput, ProjectStatus } from "@/types/project";

/**
 * Convex-based projects hook
 * Provides the same API as useProjectsSupabase
 */
export function useProjectsConvex() {
  const { t } = useTranslation();

  // Query projects from Convex
  const convexProjects = useQuery(api.projects.list);

  // Mutations
  const createProjectMutation = useMutation(api.projects.create);
  const updateProjectMutation = useMutation(api.projects.update);
  const archiveMutation = useMutation(api.projects.archive);
  const unarchiveMutation = useMutation(api.projects.unarchive);
  const removeMutation = useMutation(api.projects.remove);

  // Transform Convex projects to match the Project interface
  const projects: Project[] = useMemo(() => {
    if (!convexProjects) return [];

    return convexProjects.map((p) => ({
      id: p._id,
      name: p.name,
      description: p.description ?? null,
      color: p.color ?? "#6b7280",
      icon: p.icon ?? null,
      status: p.status as ProjectStatus,
      sort_order: p.sortOrder,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
      deleted_at: p.deletedAt ?? null,
      gcal_calendar_id: p.gcalCalendarId ?? null,
      gcal_account_id: p.gcalAccountId ?? null,
      remote_id: p._id,
      sync_status: "synced" as const,
      last_synced_at: p.updatedAt,
    }));
  }, [convexProjects]);

  const loading = convexProjects === undefined;

  /**
   * Create a new project
   */
  const createProject = useCallback(
    async (input: ProjectInput): Promise<Project> => {
      const projectId = await createProjectMutation({
        name: input.name,
        description: input.description ?? undefined,
        color: input.color ?? undefined,
        icon: input.icon ?? undefined,
      });

      toast.success(t("projects.projectCreated", "Project created"));

      const now = new Date().toISOString();
      return {
        id: projectId,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? "#6b7280",
        icon: input.icon ?? null,
        status: "active",
        sort_order: projects.length,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        gcal_calendar_id: null,
        gcal_account_id: null,
        remote_id: projectId,
        sync_status: "synced",
      };
    },
    [createProjectMutation, t, projects.length]
  );

  /**
   * Update a project
   */
  const updateProject = useCallback(
    async (id: string, input: Partial<ProjectInput>): Promise<Project> => {
      await updateProjectMutation({
        id: id as Id<"projects">,
        name: input.name,
        description: input.description ?? undefined,
        color: input.color ?? undefined,
        icon: input.icon ?? undefined,
        status: input.status,
      });

      toast.success(t("projects.projectUpdated", "Project updated"));

      // Find existing project for return value
      const existing = projects.find((p) => p.id === id);
      const now = new Date().toISOString();

      return {
        id,
        name: input.name ?? existing?.name ?? "",
        description: input.description ?? existing?.description ?? null,
        color: input.color ?? existing?.color ?? "#6b7280",
        icon: input.icon ?? existing?.icon ?? null,
        status: input.status ?? existing?.status ?? "active",
        sort_order: existing?.sort_order ?? 0,
        created_at: existing?.created_at ?? now,
        updated_at: now,
        deleted_at: null,
        gcal_calendar_id: existing?.gcal_calendar_id ?? null,
        gcal_account_id: existing?.gcal_account_id ?? null,
        remote_id: id,
        sync_status: "synced",
      };
    },
    [updateProjectMutation, t, projects]
  );

  /**
   * Update project's Google Calendar settings
   * TODO: Add Convex mutation for this
   */
  const updateProjectCalendar = useCallback(
    async (
      _id: string,
      _gcalCalendarId: string | null,
      _gcalAccountId: string | null = null
    ): Promise<void> => {
      console.warn("[useProjectsConvex] updateProjectCalendar not yet implemented");
    },
    []
  );

  /**
   * Delete a project (soft delete)
   */
  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      await removeMutation({ id: id as Id<"projects"> });
      toast.success(t("projects.projectDeleted", "Project deleted"));
    },
    [removeMutation, t]
  );

  /**
   * Archive a project
   */
  const archiveProject = useCallback(
    async (id: string): Promise<void> => {
      await archiveMutation({ id: id as Id<"projects"> });
      toast.success(t("projects.projectArchived", "Project archived"));
    },
    [archiveMutation, t]
  );

  /**
   * Unarchive a project
   */
  const unarchiveProject = useCallback(
    async (id: string): Promise<void> => {
      await unarchiveMutation({ id: id as Id<"projects"> });
      toast.success(t("projects.projectUnarchived", "Project restored"));
    },
    [unarchiveMutation, t]
  );

  /**
   * Get active projects only
   */
  const getActiveProjects = useCallback((): Project[] => {
    return projects.filter((p) => p.status === "active");
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
   * Note: Returns 0 for now, components should handle this separately
   */
  const getNotesCountForProject = useCallback((_projectId: string): number => {
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
    unarchiveProject,
    getActiveProjects,
    getProject,
    getNotesCountForProject,
  };
}
