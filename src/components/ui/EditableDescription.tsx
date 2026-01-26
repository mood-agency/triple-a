import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
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
import { useDebugNavigation } from '@/hooks/useDebugNavigation';

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
    const { debugMode, debugDescriptionFocusClass } = useDebugNavigation();
    const [isFocused, setIsFocused] = useState(false);

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
            // If Escape was pressed, we've handled it - prevent Tiptap and other handlers
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              return true;
            }
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
        const json = JSON.stringify(editor.getJSON());
        lastExternalValueRef.current = json;
        onChange(json);
      },
      onBlur: () => {
        setIsFocused(false);
        onBlur?.();
      },
      onFocus: () => {
        setIsFocused(true);
        onFocus?.();
      },
    });

    // Initialize content once editor is ready
    useEffect(() => {
      if (!editor || isInitializedRef.current) return;
      isInitializedRef.current = true;
      if (value) {
        lastExternalValueRef.current = value;
        try {
          const parsed = JSON.parse(value);
          editor.commands.setContent(parsed);
        } catch {
          // Fallback for legacy content (plain text or markdown)
          editor.commands.setContent(value);
        }
      }
    }, [editor, value]);

    // Sync value from external source (when switching notes)
    useEffect(() => {
      if (!editor || !isInitializedRef.current) return;

      if (lastExternalValueRef.current !== value) {
        lastExternalValueRef.current = value;
        try {
          const parsed = JSON.parse(value);
          editor.commands.setContent(parsed);
        } catch {
          // Fallback for legacy content (plain text or markdown)
          editor.commands.setContent(value);
        }
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
        className={`${className} ${debugMode && isFocused ? debugDescriptionFocusClass : ''}`}
      />
    );
  }
);
