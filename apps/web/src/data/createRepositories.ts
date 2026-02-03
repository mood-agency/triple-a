import type { ConvexReactClient } from 'convex/react';
import { SupabaseNoteRepository } from './supabase/SupabaseNoteRepository';
import { SupabaseLabelRepository } from './supabase/SupabaseLabelRepository';
import { SupabaseAssigneeRepository } from './supabase/SupabaseAssigneeRepository';
import { ConvexNoteRepository } from './convex/ConvexNoteRepository';
import { ConvexLabelRepository } from './convex/ConvexLabelRepository';
import { ConvexAssigneeRepository } from './convex/ConvexAssigneeRepository';
import type { Repositories } from './types';
import { formatLocalDate } from '@/utils/dateUtils';

/**
 * Backend type for repository creation
 */
export type BackendType = 'supabase' | 'convex';

/**
 * Options for creating Supabase repositories
 */
export interface CreateSupabaseRepositoriesOptions {
  userId: string;
  projectId?: string | null;
  date?: string;
}

/**
 * Options for creating Convex repositories
 */
export interface CreateConvexRepositoriesOptions {
  convex: ConvexReactClient;
  userId: string;
  projectId?: string | null;
  date?: string;
}

/**
 * Union type for repository options based on backend
 */
export type CreateRepositoriesOptions =
  | ({ backend: 'supabase' } & CreateSupabaseRepositoriesOptions)
  | ({ backend: 'convex' } & CreateConvexRepositoriesOptions);

/**
 * Factory function to create Supabase repositories
 */
export function createSupabaseRepositories(options: CreateSupabaseRepositoriesOptions): Repositories {
  const { userId, projectId = null, date = formatLocalDate(new Date()) } = options;

  return {
    notes: new SupabaseNoteRepository(userId, projectId, date),
    labels: new SupabaseLabelRepository(userId),
    assignees: new SupabaseAssigneeRepository(userId),
  };
}

/**
 * Factory function to create Convex repositories
 *
 * NOTE: Convex repositories are not yet implemented.
 * Each method will throw an error until the implementation is complete.
 */
export function createConvexRepositories(options: CreateConvexRepositoriesOptions): Repositories {
  const { convex, userId, projectId = null, date = formatLocalDate(new Date()) } = options;

  return {
    notes: new ConvexNoteRepository(convex, userId, projectId, date),
    labels: new ConvexLabelRepository(convex, userId),
    assignees: new ConvexAssigneeRepository(convex, userId),
  };
}

/**
 * Main factory function that creates repositories based on backend type
 *
 * Usage:
 * ```typescript
 * // For Supabase (default)
 * const repos = createRepositories({
 *   backend: 'supabase',
 *   userId: 'user-123',
 *   projectId: 'project-456',
 * });
 *
 * // For Convex
 * const repos = createRepositories({
 *   backend: 'convex',
 *   convex: convexClient,
 *   userId: 'user-123',
 * });
 * ```
 */
export function createRepositories(options: CreateRepositoriesOptions): Repositories {
  if (options.backend === 'convex') {
    return createConvexRepositories(options);
  }

  // Default to Supabase
  return createSupabaseRepositories(options);
}

/**
 * Type guard to check if options are for Convex
 */
export function isConvexOptions(
  options: CreateRepositoriesOptions
): options is { backend: 'convex' } & CreateConvexRepositoriesOptions {
  return options.backend === 'convex';
}

/**
 * Type guard to check if options are for Supabase
 */
export function isSupabaseOptions(
  options: CreateRepositoriesOptions
): options is { backend: 'supabase' } & CreateSupabaseRepositoriesOptions {
  return options.backend === 'supabase';
}
