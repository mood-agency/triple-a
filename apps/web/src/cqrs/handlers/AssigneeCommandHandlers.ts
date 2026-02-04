import type { CommandHandler } from '../types';
import type { IAssigneeRepository } from '@/data/types';
import { eventBus } from '@/events';
import {
  AddAssigneeToNoteCommand,
  RemoveAssigneeFromNoteCommand,
  SetNoteAssigneesCommand,
} from '../commands/assignees/AssigneeCommands';

/**
 * Creates handlers for assignee-related commands.
 * Uses the repository pattern for database abstraction (Convex-ready).
 */
export function createAssigneeCommandHandlers(assigneeRepository: IAssigneeRepository) {
  const handleAddAssigneeToNote: CommandHandler<AddAssigneeToNoteCommand> = async (command) => {
    await assigneeRepository.addToNote(
      command.payload.noteId,
      command.payload.contactId
    );

    eventBus.emit('assignee:added', {
      noteId: command.payload.noteId,
      contactId: command.payload.contactId,
    }, 'command');
  };

  const handleRemoveAssigneeFromNote: CommandHandler<RemoveAssigneeFromNoteCommand> = async (command) => {
    await assigneeRepository.removeFromNote(
      command.payload.noteId,
      command.payload.contactId
    );

    eventBus.emit('assignee:removed', {
      noteId: command.payload.noteId,
      contactId: command.payload.contactId,
    }, 'command');
  };

  const handleSetNoteAssignees: CommandHandler<SetNoteAssigneesCommand> = async (command) => {
    await assigneeRepository.setNoteAssignees(
      command.payload.noteId,
      command.payload.contactIds
    );

    // Emit event for UI updates
    eventBus.emit('assignee:added', {
      noteId: command.payload.noteId,
      contactId: command.payload.contactIds[0] || '',
    }, 'command');
  };

  return {
    AddAssigneeToNote: handleAddAssigneeToNote,
    RemoveAssigneeFromNote: handleRemoveAssigneeFromNote,
    SetNoteAssignees: handleSetNoteAssignees,
  };
}

// Type for the handlers object
export type AssigneeCommandHandlers = ReturnType<typeof createAssigneeCommandHandlers>;
