import { useCallback } from 'react';
import { parseHashtags, type HashtagParseResult } from '@/utils/hashtagParser';
import { getBlockContent } from '@/utils/noteBlockAdapter';
import { useLabels } from '@/hooks/useLabels';
import { useContacts } from '@/hooks/useContacts';
import { eventBus } from '@/events';
import type { Note, NoteCategory, Label } from '@/types/note';

interface NoteBlockProcessingCallbacks {
  onEdit?: (noteId: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onAddLabel?: (noteId: string, labelId: string) => void | Promise<void>;
  onCreateLabelAndAdd?: (noteId: string, labelName: string) => void | Promise<void>;
  onAddAssignee?: (noteId: string, contactId: string) => void;
}

export interface ProcessNoteBlockResult {
  finalCategory: NoteCategory;
  labelIds: string[];
  parsedAssigneeId: string | null;
  parsed: HashtagParseResult;
}

interface UseNoteBlockProcessingParams {
  notes: Note[];
  noteLabelsCache: Map<string, Label[]>;
  editor: any;
  callbacks: NoteBlockProcessingCallbacks;
  /** DOM fallback for content extraction (BlockNoteNoteList-specific) */
  getBlockContentFromDOM?: (blockId: string) => string;
  /** Ref to set during internal saves to prevent sync loops (BlockNoteNoteList-specific) */
  isSavingInternallyRef?: React.MutableRefObject<boolean>;
}

/**
 * Shared hook for hashtag/mention parsing and side-effect execution in note blocks.
 * Used by both BlockNoteNoteList (list mode) and TimelineBlockNoteList (calendar mode).
 */
export function useNoteBlockProcessing({
  notes,
  noteLabelsCache,
  editor,
  callbacks,
  getBlockContentFromDOM,
  isSavingInternallyRef,
}: UseNoteBlockProcessingParams) {
  const { labels } = useLabels();
  const { contacts } = useContacts();

  /**
   * Lightweight: parse and return cleaned content only (no side effects, no editor update).
   * Used by BlockNoteNoteList's getItemData in the navigation mediator.
   */
  const getCleanedContent = useCallback((content: string): string => {
    const { cleanedContent } = parseHashtags(content, { labels, contacts });
    return cleanedContent;
  }, [labels, contacts]);

  /**
   * Full processing pipeline for a single block:
   * parse hashtags/mentions, update editor block, call onEdit/onAddLabel/onCreateLabelAndAdd/onAddAssignee.
   */
  const processNoteBlock = useCallback(async (noteId: string): Promise<ProcessNoteBlockResult | null> => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return null;

    const block = editor.getBlock(noteId);
    if (!block) return null;

    // Try BlockNote's data structure first, fall back to DOM if provided
    let content = getBlockContent(block);
    if (!content && getBlockContentFromDOM) {
      content = getBlockContentFromDOM(noteId);
    }

    const parsed = parseHashtags(content, { labels, contacts });

    // 1. Update the block in the editor (clean the title)
    if (parsed.cleanedContent !== content) {
      editor.updateBlock(block, {
        content: [{ type: 'text', text: parsed.cleanedContent }]
      } as any);
    }

    // 2. Determine final category
    const finalCategory = parsed.category || note.category;

    // 3. Save note if content or category changed (via callback)
    if (parsed.cleanedContent !== note.content || finalCategory !== note.category) {
      if (isSavingInternallyRef) {
        isSavingInternallyRef.current = true;
        setTimeout(() => { isSavingInternallyRef.current = false; }, 500);
      }

      callbacks.onEdit?.(note.id, parsed.cleanedContent, finalCategory, note.description);
    }

    // 4. Handle labels
    const inheritedLabels = noteLabelsCache.get(note.id) ?? [];
    const labelIds = inheritedLabels.map(l => l.id);

    if (parsed.newLabelNames.length > 0 && callbacks.onCreateLabelAndAdd) {
      for (const labelName of parsed.newLabelNames) {
        await callbacks.onCreateLabelAndAdd(note.id, labelName);
      }
    }

    for (const hashtag of parsed.parsedHashtags) {
      if (hashtag.type === 'label' && hashtag.matchedId) {
        if (callbacks.onAddLabel) {
          await callbacks.onAddLabel(note.id, hashtag.matchedId);
        }
        if (!labelIds.includes(hashtag.matchedId)) {
          labelIds.push(hashtag.matchedId);
        }
      } else if (hashtag.type === 'contact' && hashtag.matchedId) {
        callbacks.onAddAssignee?.(note.id, hashtag.matchedId);
      }
    }

    return { finalCategory, labelIds, parsedAssigneeId: parsed.assigneeId, parsed };
  }, [notes, editor, labels, contacts, noteLabelsCache, getBlockContentFromDOM, isSavingInternallyRef, callbacks]);

  /**
   * Batch processing: iterate all notepad blocks, parse changed ones, emit single saveSuccess.
   * Replaces TimelineBlockNoteList's flushPendingSaves body.
   */
  const processAllBlocks = useCallback(async (): Promise<number> => {
    const blocks = editor.document;
    let savedCount = 0;

    for (const block of blocks) {
      if ((block as any).type !== 'notepad') continue;

      const note = notes.find(n => n.id === block.id);
      if (!note) continue;

      const content = getBlockContent(block);

      // Only process if content actually differs from stored
      if (content === note.content) continue;

      const parsed = parseHashtags(content, { labels, contacts });

      // Update editor block if cleaned
      if (parsed.cleanedContent !== content) {
        editor.updateBlock(block, {
          content: [{ type: 'text', text: parsed.cleanedContent }]
        } as any);
      }

      const finalCategory = parsed.category || note.category;

      // Save via callback
      callbacks.onEdit?.(block.id, parsed.cleanedContent, finalCategory, note.description);
      savedCount++;

      // Handle labels and assignees
      if (parsed.newLabelNames.length > 0 && callbacks.onCreateLabelAndAdd) {
        for (const labelName of parsed.newLabelNames) {
          await callbacks.onCreateLabelAndAdd(note.id, labelName);
        }
      }
      for (const hashtag of parsed.parsedHashtags) {
        if (hashtag.type === 'label' && hashtag.matchedId) {
          await callbacks.onAddLabel?.(note.id, hashtag.matchedId);
        } else if (hashtag.type === 'contact' && hashtag.matchedId) {
          callbacks.onAddAssignee?.(note.id, hashtag.matchedId);
        }
      }
    }

    if (savedCount > 0) {
      eventBus.emit('editor:saveSuccess', { savedCount });
    }

    return savedCount;
  }, [editor, notes, labels, contacts, callbacks]);

  return {
    processNoteBlock,
    getCleanedContent,
    processAllBlocks,
    labels,
    contacts,
  };
}
