import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Download, Expand, Trash2, X } from 'lucide-react';
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
      // Create a canvas to convert the image to PNG blob
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, 'image/png');
      });

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      toast.success(t('toast.imageCopied'));
    } catch (error) {
      console.warn('[TiptapImageView] Failed to copy image:', error);
      toast.error(t('toast.imageCopyFailed'));
    }
  }, [src, t]);

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const link = document.createElement('a');
    link.href = src;
    link.download = `image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [src]);

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
        onDoubleClick={handleViewFullSize}
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
          onClick={handleDownload}
          title={t('toast.imageDownload')}
        >
          <Download size={14} />
        </button>
        <button
          type="button"
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
