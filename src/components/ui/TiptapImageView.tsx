import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Expand, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export function TiptapImageView({ node, deleteNode }: NodeViewProps) {
  const { t } = useTranslation();
  const [showLightbox, setShowLightbox] = useState(false);
  const src = node.attrs.src as string;

  const handleViewFullSize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowLightbox(true);
  }, []);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNode();
  }, [deleteNode]);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // Convert data URL to blob
      const response = await fetch(src);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);

      toast.success(t('toast.imageCopied'));
    } catch {
      toast.error(t('toast.imageCopyFailed'));
    }
  }, [src, t]);

  const handleCloseLightbox = useCallback(() => {
    setShowLightbox(false);
  }, []);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!showLightbox) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLightbox(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLightbox]);

  return (
    <NodeViewWrapper className="tiptap-image-wrapper" data-drag-handle>
      <img
        src={src}
        alt=""
        onClick={handleViewFullSize}
        draggable={false}
      />
      <div className="tiptap-image-controls" contentEditable={false}>
        <button
          type="button"
          onClick={handleViewFullSize}
          title={t('toast.imageViewFullSize')}
        >
          <Expand size={14} />
        </button>
        <button
          type="button"
          onClick={handleCopy}
          title={t('toast.imageCopy')}
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          className="delete"
          onClick={handleDelete}
          title={t('toast.imageDelete')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {showLightbox && createPortal(
        <div
          className="tiptap-image-lightbox"
          onClick={handleCloseLightbox}
        >
          <img
            src={src}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="tiptap-image-lightbox-close"
            onClick={handleCloseLightbox}
          >
            <X size={20} />
          </button>
        </div>,
        document.body
      )}
    </NodeViewWrapper>
  );
}
