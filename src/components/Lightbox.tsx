import { useEffect } from 'react';
import { CloseIcon, LeftIcon, RightIcon } from './Icons';

export interface LightboxItem {
  src: string;
  title: string;
  caption: string;
}

export function Lightbox({
  items,
  index,
  onClose,
  onIndex,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const item = items[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < items.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, items.length, onClose, onIndex]);

  if (!item) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.title || 'Image'} onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <CloseIcon />
      </button>
      {index > 0 && (
        <button
          className="lightbox-nav prev"
          aria-label="Previous work"
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index - 1);
          }}
        >
          <LeftIcon />
        </button>
      )}
      {index < items.length - 1 && (
        <button
          className="lightbox-nav next"
          aria-label="Next work"
          onClick={(e) => {
            e.stopPropagation();
            onIndex(index + 1);
          }}
        >
          <RightIcon />
        </button>
      )}
      <img src={item.src} alt={item.title || 'Artwork'} onClick={(e) => e.stopPropagation()} />
      <div className="lightbox-cap" onClick={(e) => e.stopPropagation()}>
        {item.title || <i>Untitled</i>}
        {item.caption && <span>{item.caption}</span>}
      </div>
    </div>
  );
}
