import type { Repositories } from '@/data/types';
import { commandBus } from './CommandBus';
import { queryBus } from './QueryBus';
import { createNoteCommandHandlers } from './handlers/NoteCommandHandlers';
import { createNoteQueryHandlers } from './handlers/NoteQueryHandlers';
import { createLabelCommandHandlers } from './handlers/LabelCommandHandlers';
import { createLabelQueryHandlers } from './handlers/LabelQueryHandlers';
import { createAssigneeCommandHandlers } from './handlers/AssigneeCommandHandlers';
import { createAssigneeQueryHandlers } from './handlers/AssigneeQueryHandlers';

let isRegistered = false;

/**
 * Register all command and query handlers with their respective buses.
 * Uses the repository pattern for database abstraction (Convex-ready).
 *
 * @param repositories - The repository implementations to use
 */
export function registerHandlers(repositories: Repositories): void {
  if (isRegistered) {
    console.debug('[CQRS] Handlers already registered, skipping');
    return;
  }

  console.debug('[CQRS] Registering command and query handlers');

  // Create handlers with repository dependencies
  const noteCommandHandlers = createNoteCommandHandlers(repositories.notes);
  const noteQueryHandlers = createNoteQueryHandlers(repositories.notes);
  const labelCommandHandlers = createLabelCommandHandlers(repositories.labels);
  const labelQueryHandlers = createLabelQueryHandlers(repositories.labels);
  const assigneeCommandHandlers = createAssigneeCommandHandlers(repositories.assignees);
  const assigneeQueryHandlers = createAssigneeQueryHandlers(repositories.assignees);

  // Register note command handlers
  commandBus.register('CreateNote', noteCommandHandlers.CreateNote);
  commandBus.register('CreateNoteAfter', noteCommandHandlers.CreateNoteAfter);
  commandBus.register('UpdateNote', noteCommandHandlers.UpdateNote);
  commandBus.register('DeleteNote', noteCommandHandlers.DeleteNote);
  commandBus.register('RestoreNote', noteCommandHandlers.RestoreNote);
  commandBus.register('ToggleCompleted', noteCommandHandlers.ToggleCompleted);
  commandBus.register('TogglePinned', noteCommandHandlers.TogglePinned);
  commandBus.register('ReorderNotes', noteCommandHandlers.ReorderNotes);
  commandBus.register('PostponeNote', noteCommandHandlers.PostponeNote);

  // Register note query handlers
  queryBus.register('GetNotes', noteQueryHandlers.GetNotes);
  queryBus.register('GetNoteById', noteQueryHandlers.GetNoteById);
  queryBus.register('GetNoteVersions', noteQueryHandlers.GetNoteVersions);
  queryBus.register('GetNoteActions', noteQueryHandlers.GetNoteActions);

  // Register label command handlers
  commandBus.register('AddLabelToNote', labelCommandHandlers.AddLabelToNote);
  commandBus.register('RemoveLabelFromNote', labelCommandHandlers.RemoveLabelFromNote);
  commandBus.register('CreateLabel', labelCommandHandlers.CreateLabel);
  commandBus.register('CreateLabelAndAddToNote', labelCommandHandlers.CreateLabelAndAddToNote);

  // Register label query handlers
  queryBus.register('GetLabels', labelQueryHandlers.GetLabels);
  queryBus.register('GetLabelsForNote', labelQueryHandlers.GetLabelsForNote);
  queryBus.register('GetNoteLabelsMap', labelQueryHandlers.GetNoteLabelsMap);

  // Register assignee command handlers
  commandBus.register('AddAssigneeToNote', assigneeCommandHandlers.AddAssigneeToNote);
  commandBus.register('RemoveAssigneeFromNote', assigneeCommandHandlers.RemoveAssigneeFromNote);
  commandBus.register('SetNoteAssignees', assigneeCommandHandlers.SetNoteAssignees);

  // Register assignee query handlers
  queryBus.register('GetContacts', assigneeQueryHandlers.GetContacts);
  queryBus.register('GetAssigneesForNote', assigneeQueryHandlers.GetAssigneesForNote);
  queryBus.register('GetNoteAssigneesMap', assigneeQueryHandlers.GetNoteAssigneesMap);

  isRegistered = true;
  console.debug('[CQRS] Handlers registered successfully');
}

/**
 * Clear all registered handlers (for testing)
 */
export function clearHandlers(): void {
  commandBus.clear();
  queryBus.clear();
  isRegistered = false;
}
