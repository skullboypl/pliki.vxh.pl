'use client';

import { useRef } from 'react';
import type { BoardImage } from '@/lib/notesProtocol';

type Props = {
  image: BoardImage;
  tool: 'card' | 'draw';
  onUpdate: (image: BoardImage, final: boolean) => void;
  onDelete: (id: string) => void;
};

type DragKind = 'move' | 'resize-se' | 'crop-se';

export default function NotesBoardImage({ image, tool, onUpdate, onDelete }: Props) {
  const dragRef = useRef<{
    kind: DragKind;
    startX: number;
    startY: number;
    startImg: BoardImage;
    aspect: number;
  } | null>(null);
  const pendingRef = useRef<BoardImage>(image);

  pendingRef.current = image;

  const aspect = image.w / image.h || 1;

  const onMoveDown = (e: React.PointerEvent) => {
    if (tool === 'draw') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startImg: { ...image },
      aspect,
    };
  };

  const onResizeDown = (e: React.PointerEvent) => {
    if (tool === 'draw') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const kind: DragKind = e.altKey ? 'crop-se' : 'resize-se';
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startImg: { ...image },
      aspect: image.w / image.h || 1,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const wrap = (e.currentTarget as HTMLElement).closest('.notes-app__board') as HTMLElement | null;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const s = drag.startImg;

    if (drag.kind === 'move') {
      const next = {
        ...image,
        x: Math.min(0.92, Math.max(0, s.x + dx)),
        y: Math.min(0.92, Math.max(0, s.y + dy)),
      };
      pendingRef.current = next;
      onUpdate(next, false);
      return;
    }

    if (drag.kind === 'crop-se') {
      const cropW = Math.min(1 - s.cropX, Math.max(0.08, s.cropW + dx * 2));
      const cropH = Math.min(1 - s.cropY, Math.max(0.08, s.cropH + dy * 2));
      const next = { ...image, cropW, cropH };
      pendingRef.current = next;
      onUpdate(next, false);
      return;
    }

    let nw = Math.max(0.06, s.w + dx);
    let nh = Math.max(0.06, s.h + dy);
    if (!e.ctrlKey) {
      if (Math.abs(dx) > Math.abs(dy)) nh = nw / drag.aspect;
      else nw = nh * drag.aspect;
    }
    const next = { ...image, w: Math.min(0.9, nw), h: Math.min(0.9, nh) };
    pendingRef.current = next;
    onUpdate(next, false);
  };

  const onPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    onUpdate(pendingRef.current, true);
  };

  const clipStyle = {
    objectFit: 'cover' as const,
    objectPosition: `${image.cropX * 100}% ${image.cropY * 100}%`,
    width: `${100 / image.cropW}%`,
    height: `${100 / image.cropH}%`,
    maxWidth: 'none',
    transform: `translate(${-image.cropX * 100}%, ${-image.cropY * 100}%)`,
  };

  return (
    <div
      className="notes-app__image"
      style={{
        left: `${image.x * 100}%`,
        top: `${image.y * 100}%`,
        width: `${image.w * 100}%`,
        height: `${image.h * 100}%`,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <div className="notes-app__image-head" onPointerDown={onMoveDown}>
        <span className="notes-app__image-grip" aria-hidden />
        <button
          type="button"
          className="notes-app__image-del"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(image.id);
          }}
        >
          ×
        </button>
      </div>
      <div className="notes-app__image-body">
        <img src={image.src} alt="" draggable={false} style={clipStyle} />
      </div>
      {tool !== 'draw' ? (
        <div
          className="notes-app__image-handle"
          title="Resize (Ctrl: free, Alt: crop)"
          onPointerDown={onResizeDown}
        />
      ) : null}
    </div>
  );
}
