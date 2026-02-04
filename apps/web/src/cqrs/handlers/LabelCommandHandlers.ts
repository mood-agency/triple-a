import type { CommandHandler } from '../types';
import type { ILabelRepository } from '@/data/types';
import { eventBus } from '@/events';
import {
  AddLabelToNoteCommand,
  RemoveLabelFromNoteCommand,
  CreateLabelCommand,
  CreateLabelAndAddToNoteCommand,
} from '../commands/labels/LabelCommands';

/**
 * Creates handlers for label-related commands.
 * Uses the repository pattern for database abstraction (Convex-ready).
 */
export function createLabelCommandHandlers(labelRepository: ILabelRepository) {
  const handleAddLabelToNote: CommandHandler<AddLabelToNoteCommand> = async (command) => {
    await labelRepository.addToNote(
      command.payload.noteId,
      command.payload.labelId
    );

    eventBus.emit('label:addedToNote', {
      noteId: command.payload.noteId,
      labelId: command.payload.labelId,
      labelName: '',
      labelColor: '',
    }, 'command');
  };

  const handleRemoveLabelFromNote: CommandHandler<RemoveLabelFromNoteCommand> = async (command) => {
    await labelRepository.removeFromNote(
      command.payload.noteId,
      command.payload.labelId
    );

    eventBus.emit('label:removedFromNote', {
      noteId: command.payload.noteId,
      labelId: command.payload.labelId,
    }, 'command');
  };

  const handleCreateLabel: CommandHandler<CreateLabelCommand> = async (command) => {
    const label = await labelRepository.create({
      name: command.payload.name,
      color: command.payload.color,
    });

    return label;
  };

  const handleCreateLabelAndAddToNote: CommandHandler<CreateLabelAndAddToNoteCommand> = async (command) => {
    const label = await labelRepository.createAndAddToNote(
      command.payload.noteId,
      {
        name: command.payload.name,
        color: command.payload.color,
      }
    );

    eventBus.emit('label:addedToNote', {
      noteId: command.payload.noteId,
      labelId: label.id,
      labelName: label.name,
      labelColor: label.color,
    }, 'command');

    return label;
  };

  return {
    AddLabelToNote: handleAddLabelToNote,
    RemoveLabelFromNote: handleRemoveLabelFromNote,
    CreateLabel: handleCreateLabel,
    CreateLabelAndAddToNote: handleCreateLabelAndAddToNote,
  };
}

// Type for the handlers object
export type LabelCommandHandlers = ReturnType<typeof createLabelCommandHandlers>;
