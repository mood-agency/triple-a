import type { CommandHandler } from '../types';
import type { INoteRepository } from '@/data/types';
import { eventBus } from '@/events';
import {
  CreateNoteCommand,
  CreateNoteAfterCommand,
} from '../commands/notes/CreateNoteCommand';
import { UpdateNoteCommand } from '../commands/notes/UpdateNoteCommand';
import { DeleteNoteCommand, RestoreNoteCommand } from '../commands/notes/DeleteNoteCommand';
import {
  ToggleCompletedCommand,
  TogglePinnedCommand,
  ReorderNotesCommand,
  PostponeNoteCommand,
} from '../commands/notes/ToggleNoteCommand';

/**
 * Creates handlers for note-related commands.
 * Uses the repository pattern for database abstraction (Convex-ready).
 */
export function createNoteCommandHandlers(noteRepository: INoteRepository) {
  const handleCreateNote: CommandHandler<CreateNoteCommand> = async (command) => {
    const note = await noteRepository.create({
      content: command.payload.content,
      category: command.payload.category,
      date: command.payload.date,
      description: command.payload.description,
      deadline: command.payload.deadline,
      projectId: command.payload.projectId,
    });

    eventBus.emit('note:created', {
      note,
      source: 'command',
    });

    return note;
  };

  const handleCreateNoteAfter: CommandHandler<CreateNoteAfterCommand> = async (command) => {
    const note = await noteRepository.createAfter(command.payload.afterNoteId, {
      id: command.payload.newNoteId, // Use BlockNote's block ID for sync
      content: command.payload.content,
      category: command.payload.category,
      date: command.payload.date,
      description: command.payload.description,
      deadline: command.payload.deadline,
      projectId: command.payload.projectId,
      afterNoteId: command.payload.afterNoteId,
    });

    eventBus.emit('note:created', {
      note,
      source: 'command',
    });

    return note;
  };

  const handleUpdateNote: CommandHandler<UpdateNoteCommand> = async (command) => {
    await noteRepository.update(command.payload.noteId, {
      content: command.payload.content,
      category: command.payload.category,
      description: command.payload.description,
      deadline: command.payload.deadline,
      projectId: command.payload.projectId,
      date: command.payload.date,
    });

    eventBus.emit('note:updated', {
      noteId: command.payload.noteId,
      changes: command.payload,
      source: 'command',
    });
  };

  const handleDeleteNote: CommandHandler<DeleteNoteCommand> = async (command) => {
    await noteRepository.delete(command.payload.noteId, command.payload.reason);

    eventBus.emit('note:deleted', {
      noteId: command.payload.noteId,
      source: 'command',
    });
  };

  const handleRestoreNote: CommandHandler<RestoreNoteCommand> = async (command) => {
    await noteRepository.restore(command.payload.noteId);

    // Note restored - could emit a restore event if needed
  };

  const handleToggleCompleted: CommandHandler<ToggleCompletedCommand> = async (command) => {
    await noteRepository.toggleCompleted(
      command.payload.noteId,
      command.payload.completed
    );

    eventBus.emit('note:completed', {
      noteId: command.payload.noteId,
      completed: command.payload.completed,
      completedAt: command.payload.completed ? new Date().toISOString() : null,
      source: 'command',
    });
  };

  const handleTogglePinned: CommandHandler<TogglePinnedCommand> = async (command) => {
    await noteRepository.togglePinned(
      command.payload.noteId,
      command.payload.pinned
    );

    eventBus.emit('note:pinned', {
      noteId: command.payload.noteId,
      pinned: command.payload.pinned,
      source: 'command',
    });
  };

  const handleReorderNotes: CommandHandler<ReorderNotesCommand> = async (command) => {
    await noteRepository.reorder(command.payload.noteIds);
  };

  const handlePostponeNote: CommandHandler<PostponeNoteCommand> = async (command) => {
    await noteRepository.postpone(
      command.payload.noteId,
      command.payload.newDate,
      command.payload.reason
    );

    eventBus.emit('note:updated', {
      noteId: command.payload.noteId,
      changes: { date: command.payload.newDate },
      source: 'command',
    });
  };

  return {
    CreateNote: handleCreateNote,
    CreateNoteAfter: handleCreateNoteAfter,
    UpdateNote: handleUpdateNote,
    DeleteNote: handleDeleteNote,
    RestoreNote: handleRestoreNote,
    ToggleCompleted: handleToggleCompleted,
    TogglePinned: handleTogglePinned,
    ReorderNotes: handleReorderNotes,
    PostponeNote: handlePostponeNote,
  };
}

// Type for the handlers object
export type NoteCommandHandlers = ReturnType<typeof createNoteCommandHandlers>;
