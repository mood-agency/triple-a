import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import { wrappingInputRule } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import HardBreak from '@tiptap/extension-hard-break';
import History from '@tiptap/extension-history';
import Heading from '@tiptap/extension-heading';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { TiptapImageView } from './TiptapImageView';

// Register common languages (includes json, javascript, typescript, bash, css, html, python, sql, etc.)
const lowlight = createLowlight(common);

interface EditableDescriptionProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  className?: string;
}

export interface EditableDescriptionHandle {
  focus: () => void;
  blur: () => void;
  getSelectionInfo: () => { cursorPosition: number; text: string } | null;
  setCursorPosition: (position: number) => void;
}

// Helper function to clean legacy HTML content and convert to markdown
function cleanLegacyContent(content: string): string {
  if (!content) return '';

  let cleaned = content;

  // If the content contains escaped HTML entities, clean it up
  if (cleaned.includes('&lt;') || cleaned.includes('&gt;')) {
    // Decode HTML entities
    cleaned = cleaned.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  }

  // If the content contains HTML tags, convert to markdown
  if (cleaned.includes('<p>') || cleaned.includes('</p>') || cleaned.includes('<strong>') || cleaned.includes('<a ')) {
    // Remove <br> tags and convert to newlines
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    // Remove paragraph tags and convert to newlines
    cleaned = cleaned.replace(/<\/p>\s*<p>/g, '\n\n');
    cleaned = cleaned.replace(/<p>/g, '').replace(/<\/p>/g, '');
    // Extract text from anchor tags
    cleaned = cleaned.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g, '[$2]($1)');
    // Extract content from code blocks with language
    cleaned = cleaned.replace(/<pre><code[^>]*class="language-(\w+)"[^>]*>([\s\S]*?)<\/code><\/pre>/g, '```$1\n$2\n```');
    // Extract content from code blocks without language
    cleaned = cleaned.replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```');
    // Extract content from inline code
    cleaned = cleaned.replace(/<code>([^<]*)<\/code>/g, '`$1`');
    // Extract content from strong/bold
    cleaned = cleaned.replace(/<strong>([^<]*)<\/strong>/g, '**$1**');
    cleaned = cleaned.replace(/<b>([^<]*)<\/b>/g, '**$1**');
    // Extract content from em/italic
    cleaned = cleaned.replace(/<em>([^<]*)<\/em>/g, '*$1*');
    cleaned = cleaned.replace(/<i>([^<]*)<\/i>/g, '*$1*');
    // Remove any remaining HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    // Clean up multiple newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();
  }

  return cleaned;
}

// Custom TaskItem with input rule for "- [ ] " and "- [x] " using wrappingInputRule
const CustomTaskItem = TaskItem.extend({
  addInputRules() {
    return [
      // Match "- [ ] " or "- [x] " for markdown-style task lists
      wrappingInputRule({
        find: /^-\s\[([( |x])?\]\s$/,
        type: this.type,
        getAttributes: match => ({
          checked: match[1]?.toLowerCase() === 'x',
        }),
      }),
    ];
  },
});

// Custom BulletList that only triggers with * (not -) to avoid conflict with checkboxes
// Users can still use - for checkboxes: - [ ] or - [x]
const CustomBulletList = BulletList.extend({
  addInputRules() {
    return [
      wrappingInputRule({
        // Only trigger bullet list with * to avoid conflict with - [ ] checkbox pattern
        find: /^\s*\*\s$/,
        type: this.type,
      }),
    ];
  },
});

// Custom Image extension with React NodeView for controls and drag support
const CustomImage = Image.extend({
  draggable: true,

  addNodeView() {
    return ReactNodeViewRenderer(TiptapImageView);
  },
});

// Custom CodeBlockLowlight that preserves language from markdown
const CustomCodeBlockLowlight = CodeBlockLowlight.extend({
  parseHTML() {
    return [
      ...(this.parent?.() || []),
      {
        tag: 'pre',
        preserveWhitespace: 'full',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const code = element.querySelector('code');
          if (code) {
            const className = code.className || '';
            const match = className.match(/language-(\w+)/);
            if (match) {
              return { language: match[1] };
            }
          }
          return null;
        },
      },
    ];
  },
});

export const EditableDescription = forwardRef<EditableDescriptionHandle, EditableDescriptionProps>(
  function EditableDescription(
    { value, onChange, onBlur, onFocus, onKeyDown, placeholder, className = '' },
    ref
  ) {
    const lastExternalValueRef = useRef(value);
    const isInitializedRef = useRef(false);

    const editor = useEditor({
      extensions: [
        Document,
        Paragraph,
        Text,
        Bold,
        Italic,
        Strike,
        Code,
        HardBreak,
        History,
        Heading.configure({
          levels: [1, 2, 3, 4, 5, 6],
        }),
        CustomBulletList.configure({
          HTMLAttributes: {
            class: 'tiptap-bullet-list',
          },
        }),
        OrderedList.configure({
          HTMLAttributes: {
            class: 'tiptap-ordered-list',
          },
        }),
        ListItem.configure({
          HTMLAttributes: {
            class: 'tiptap-list-item',
          },
        }),
        TaskList.configure({
          HTMLAttributes: {
            class: 'tiptap-task-list',
          },
        }),
        CustomTaskItem.configure({
          nested: true,
          HTMLAttributes: {
            class: 'tiptap-task-item',
          },
        }),
        CustomCodeBlockLowlight.configure({
          lowlight,
          HTMLAttributes: {
            class: 'tiptap-code-block',
          },
        }),
        Link.configure({
          openOnClick: true,
          autolink: true,
          HTMLAttributes: {
            class: 'text-primary underline cursor-pointer hover:text-primary/80',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
        Placeholder.configure({
          placeholder: placeholder || '',
          emptyEditorClass: 'is-editor-empty',
        }),
        Markdown.configure({
          html: false,
          transformPastedText: true,
          transformCopiedText: true,
          breaks: true,
          tightLists: true,
          bulletListMarker: '-',
        }),
        CustomImage.configure({
          inline: true,
          allowBase64: true,
        }),
      ],
      content: '',
      editorProps: {
        attributes: {
          class: `outline-none whitespace-pre-wrap break-words ${className}`,
          style: 'min-height: 1em',
        },
        handleKeyDown: (_view, event) => {
          if (onKeyDown) {
            const syntheticEvent = {
              key: event.key,
              shiftKey: event.shiftKey,
              ctrlKey: event.ctrlKey,
              altKey: event.altKey,
              metaKey: event.metaKey,
              preventDefault: () => event.preventDefault(),
              stopPropagation: () => event.stopPropagation(),
            } as React.KeyboardEvent<HTMLDivElement>;
            onKeyDown(syntheticEvent);
          }
          return false;
        },
        handleTextInput: (_view, _from, _to, _text) => {
          // Allow all text input to pass through to input rules
          // This enables bullet lists (- or *), ordered lists (1.), and task lists (- [ ])
          return false;
        },
        handlePaste: (view, event) => {
          const items = event.clipboardData?.items;
          if (!items) return false;

          // Security limits
          const MAX_IMAGE_SIZE_MB = Number(import.meta.env.VITE_MAX_IMAGE_SIZE_MB) || 5;
          const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
          const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

          for (const item of items) {
            if (item.type.startsWith('image/')) {
              event.preventDefault();

              // Validate MIME type
              if (!ALLOWED_TYPES.includes(item.type)) {
                const format = item.type.split('/')[1]?.toUpperCase() || 'unknown';
                toast.error(i18n.t('toast.imageUnsupportedFormat'), {
                  description: i18n.t('toast.imageUnsupportedFormatDescription', { format }),
                });
                return true;
              }

              const file = item.getAsFile();
              if (file) {
                // Validate file size
                if (file.size > MAX_IMAGE_SIZE_BYTES) {
                  const fileSize = (file.size / 1024 / 1024).toFixed(1);
                  toast.error(i18n.t('toast.imageTooLarge'), {
                    description: i18n.t('toast.imageTooLargeDescription', {
                      maxSize: MAX_IMAGE_SIZE_MB,
                      fileSize
                    }),
                  });
                  return true;
                }

                const reader = new FileReader();
                reader.onload = (readerEvent) => {
                  const src = readerEvent.target?.result as string;

                  // Validate data URL format
                  if (!src.startsWith('data:image/')) {
                    toast.error(i18n.t('toast.imageInvalid'), {
                      description: i18n.t('toast.imageInvalidDescription'),
                    });
                    return;
                  }

                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({ src })
                    )
                  );
                };
                reader.readAsDataURL(file);
              }
              return true;
            }
          }
          return false;
        },
        handleDrop: (view, event, _slice, moved) => {
          // Don't handle if it's an internal move (reordering within editor)
          if (moved) return false;

          const files = event.dataTransfer?.files;
          if (!files || files.length === 0) return false;

          // Security limits
          const MAX_IMAGE_SIZE_MB = Number(import.meta.env.VITE_MAX_IMAGE_SIZE_MB) || 5;
          const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;
          const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

          for (const file of files) {
            if (file.type.startsWith('image/')) {
              event.preventDefault();

              // Validate MIME type
              if (!ALLOWED_TYPES.includes(file.type)) {
                const format = file.type.split('/')[1]?.toUpperCase() || 'unknown';
                toast.error(i18n.t('toast.imageUnsupportedFormat'), {
                  description: i18n.t('toast.imageUnsupportedFormatDescription', { format }),
                });
                return true;
              }

              // Validate file size
              if (file.size > MAX_IMAGE_SIZE_BYTES) {
                const fileSize = (file.size / 1024 / 1024).toFixed(1);
                toast.error(i18n.t('toast.imageTooLarge'), {
                  description: i18n.t('toast.imageTooLargeDescription', {
                    maxSize: MAX_IMAGE_SIZE_MB,
                    fileSize
                  }),
                });
                return true;
              }

              const reader = new FileReader();
              reader.onload = (readerEvent) => {
                const src = readerEvent.target?.result as string;

                // Validate data URL format
                if (!src.startsWith('data:image/')) {
                  toast.error(i18n.t('toast.imageInvalid'), {
                    description: i18n.t('toast.imageInvalidDescription'),
                  });
                  return;
                }

                // Get the drop position
                const coordinates = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });

                if (coordinates) {
                  const { tr } = view.state;
                  const imageNode = view.state.schema.nodes.image.create({ src });
                  tr.insert(coordinates.pos, imageNode);
                  view.dispatch(tr);
                } else {
                  // Fallback: insert at cursor position
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({ src })
                    )
                  );
                }
              };
              reader.readAsDataURL(file);
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markdown = (editor.storage as any).markdown?.getMarkdown() || editor.getText();
        lastExternalValueRef.current = markdown;
        onChange(markdown);
      },
      onBlur: () => onBlur?.(),
      onFocus: () => onFocus?.(),
    });

    // Initialize content once editor is ready
    useEffect(() => {
      if (!editor || isInitializedRef.current) return;
      isInitializedRef.current = true;
      if (value) {
        const markdown = cleanLegacyContent(value);
        lastExternalValueRef.current = markdown;
        // tiptap-markdown parses markdown automatically when using setContent
        editor.commands.setContent(markdown);
      }
    }, [editor, value]);

    // Sync value from external source (when switching notes)
    useEffect(() => {
      if (!editor || !isInitializedRef.current) return;

      if (lastExternalValueRef.current !== value) {
        const markdown = cleanLegacyContent(value);
        lastExternalValueRef.current = markdown;
        editor.commands.setContent(markdown);
      }
    }, [value, editor]);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      focus: () => editor?.commands.focus(),
      blur: () => editor?.commands.blur(),
      getSelectionInfo: () => {
        if (!editor) return null;
        const { from } = editor.state.selection;
        const text = editor.getText();
        return {
          cursorPosition: from - 1,
          text,
        };
      },
      setCursorPosition: (position: number) => {
        if (!editor) return;
        const docPosition = Math.min(position + 1, editor.state.doc.content.size);
        editor.commands.setTextSelection(docPosition);
      },
    }), [editor]);

    return (
      <EditorContent
        editor={editor}
        className={className}
      />
    );
  }
);
