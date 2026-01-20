import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { parseTextWithLinks } from '@/lib/linkify';

interface EditableDescriptionProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
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

export const EditableDescription = forwardRef<EditableDescriptionHandle, EditableDescriptionProps>(
  function EditableDescription(
    { value, onChange, onBlur, onKeyDown, placeholder, className = '' },
    ref
  ) {
    const editorRef = useRef<HTMLDivElement>(null);
    const isComposingRef = useRef(false);
    const lastValueRef = useRef(value);

    // Get cursor position as character offset
    const getCursorPosition = useCallback(() => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !editorRef.current) return 0;

      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editorRef.current);
      preCaretRange.setEnd(range.startContainer, range.startOffset);

      // Count characters including newlines from BR elements
      let position = 0;
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_ALL,
        null
      );

      let node: Node | null = editorRef.current;
      const endContainer = range.startContainer;
      const endOffset = range.startOffset;

      while (node) {
        if (node === endContainer) {
          if (node.nodeType === Node.TEXT_NODE) {
            position += endOffset;
          }
          break;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          position += node.textContent?.length || 0;
        } else if (node.nodeName === 'BR') {
          position += 1; // Count BR as newline
        }

        node = walker.nextNode();
      }

      return position;
    }, []);

    // Set cursor at specific position
    const setCursorPosition = useCallback((position: number) => {
      if (!editorRef.current) return;

      const selection = window.getSelection();
      if (!selection) return;

      let currentPos = 0;
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_ALL,
        null
      );

      let node: Node | null = null;
      while ((node = walker.nextNode())) {
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeLength = node.textContent?.length || 0;
          if (currentPos + nodeLength >= position) {
            const range = document.createRange();
            range.setStart(node, position - currentPos);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
          }
          currentPos += nodeLength;
        } else if (node.nodeName === 'BR') {
          if (currentPos === position) {
            // Position cursor after the BR
            const range = document.createRange();
            range.setStartAfter(node);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            return;
          }
          currentPos += 1;
        }
      }

      // If position is at or beyond the end, place cursor at the end
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }, []);

    // Get plain text from the editor
    const getPlainText = useCallback(() => {
      if (!editorRef.current) return '';

      let text = '';
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_ALL,
        null
      );

      let node: Node | null = editorRef.current;
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        } else if (node.nodeName === 'BR') {
          text += '\n';
        } else if (node.nodeName === 'DIV' && node !== editorRef.current && text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }
        node = walker.nextNode();
      }

      return text;
    }, []);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      focus: () => editorRef.current?.focus(),
      blur: () => editorRef.current?.blur(),
      getSelectionInfo: () => {
        if (!editorRef.current) return null;
        return {
          cursorPosition: getCursorPosition(),
          text: getPlainText(),
        };
      },
      setCursorPosition,
    }), [getCursorPosition, getPlainText, setCursorPosition]);

    // Render content with linkified URLs
    const renderContent = useCallback(() => {
      if (!editorRef.current) return;

      const cursorPos = getCursorPosition();
      const isFocused = document.activeElement === editorRef.current;

      // Clear and rebuild content
      editorRef.current.innerHTML = '';

      if (!value) {
        return;
      }

      const lines = value.split('\n');

      lines.forEach((line, lineIndex) => {
        const segments = parseTextWithLinks(line);

        if (segments.length === 0 && line === '') {
          // Empty line - add a BR
          if (lineIndex > 0) {
            editorRef.current!.appendChild(document.createElement('br'));
          }
        } else {
          if (lineIndex > 0) {
            editorRef.current!.appendChild(document.createElement('br'));
          }

          segments.forEach((segment) => {
            if (segment.type === 'link') {
              const span = document.createElement('span');
              span.textContent = segment.value;
              span.className = 'detected-link';
              span.dataset.url = segment.value;
              editorRef.current!.appendChild(span);
            } else {
              const textNode = document.createTextNode(segment.value);
              editorRef.current!.appendChild(textNode);
            }
          });
        }
      });

      // Restore cursor position if focused
      if (isFocused) {
        setCursorPosition(cursorPos);
      }
    }, [value, getCursorPosition, setCursorPosition]);

    // Sync value to DOM when value prop changes (from external source)
    useEffect(() => {
      if (lastValueRef.current !== value) {
        lastValueRef.current = value;
        renderContent();
      }
    }, [value, renderContent]);

    // Initial render
    useEffect(() => {
      renderContent();
    }, []);

    const handleInput = useCallback(() => {
      if (isComposingRef.current) return;

      const newValue = getPlainText();
      if (newValue !== lastValueRef.current) {
        lastValueRef.current = newValue;
        onChange(newValue);

        // Re-render to update link styling
        requestAnimationFrame(() => {
          renderContent();
        });
      }
    }, [getPlainText, onChange, renderContent]);

    const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;

      // Check if Ctrl+Click on a link
      if (e.ctrlKey && target.classList.contains('detected-link')) {
        e.preventDefault();
        const url = target.dataset.url;
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
    }, [onKeyDown]);

    const handleCompositionStart = useCallback(() => {
      isComposingRef.current = true;
    }, []);

    const handleCompositionEnd = useCallback(() => {
      isComposingRef.current = false;
      handleInput();
    }, [handleInput]);

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    }, []);

    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={onBlur}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={`outline-none whitespace-pre-wrap break-words ${className}`}
        style={{ minHeight: '1em' }}
      />
    );
  }
);
