import type { NoteCategory } from "@/types/note";

/**
 * CreateInitialNoteCommand - Creates an initial empty note when no notes exist
 *
 * This command follows the Command Pattern and dispatches an event to create
 * the first note in an empty note list, enabling the "notepad behavior" where
 * there's always a note ready for the user to write in.
 */
export class CreateInitialNoteCommand {
  private category: NoteCategory;
  private labelIds: string[];

  constructor(category: NoteCategory = 'todo', labelIds: string[] = []) {
    this.category = category;
    this.labelIds = labelIds;
  }

  execute(): boolean {
    // Dispatch event to create initial note
    window.dispatchEvent(new CustomEvent('notepad:createInitialNote', {
      detail: {
        category: this.category,
        labelIds: this.labelIds,
      }
    }));

    return true;
  }

  canExecute(): boolean {
    return true;
  }
}
