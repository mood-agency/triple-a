import { SupabaseNoteRepository } from './supabase/SupabaseNoteRepository';
import { SupabaseLabelRepository } from './supabase/SupabaseLabelRepository';
import { SupabaseAssigneeRepository } from './supabase/SupabaseAssigneeRepository';
import type { Repositories } from './types';
import { formatLocalDate } from '@/utils/dateUtils';

export interface CreateRepositoriesOptions {
  userId: string;
  projectId?: string | null;
  date?: string;
}

/**
 * Factory function to create Supabase repositories
 * In the future, this can be swapped to create Convex repositories
 */
export function createSupabaseRepositories(options: CreateRepositoriesOptions): Repositories {
  const { userId, projectId = null, date = formatLocalDate(new Date()) } = options;

  return {
    notes: new SupabaseNoteRepository(userId, projectId, date),
    labels: new SupabaseLabelRepository(userId),
    assignees: new SupabaseAssigneeRepository(userId),
  };
}
