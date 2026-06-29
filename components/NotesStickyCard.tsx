'use client';

import { useEffect, useRef } from 'react';
import type { StickyCard } from '@/lib/notesProtocol';

type Props = {
  card: StickyCard;
  tool: 'card' | 'draw';
  active: boolean;
  placeholder: string;
  deleteLabel: string;
  resizeLabel: string;
  onDelete: (id: string) => void;
  onHtmlChange: (id: string, html: string, live: boolean) => void;
  onActivate: (id: string, el: HTMLDivElement | null) => void;
  onDragStart: (e: React.PointerEvent<HTMLDivElement>, card: StickyCard) => void;
  onDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onResize: (card: StickyCard, final: boolean) => void;
};

export default function NotesStickyCard({
  card,
  tool,
  active,
  placeholder,
  deleteLabel,
  resizeLabel,
  onDelete,
  onHtmlChange,
  onActivate,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResize,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);
  const pendingRef = useRef<StickyCard>(card);
  pendingRef.current = card;

  useEffect(() => {
    const el = editorRef.current;
    if (!el || focusedRef.current) return;
    if (el.innerHTML !== card.html) el.innerHTML = card.html;
  }, [card.html, card.id]);

  const onInput = () => {
    const html = editorRef.current?.innerHTML ?? '';
    onHtmlChange(card.id, html, true);
  };

  const onBlur = () => {
    focusedRef.current = false;
    const html = editorRef.current?.innerHTML ?? '';
    onHtmlChange(card.id, html, false);
  };

  const onResizeDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (tool !== 'card') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: card.w, startH: card.h };
  };

  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizeRef.current;
    if (!r) return;
    const board = (e.currentTarget as HTMLElement).closest('.notes-app__board') as HTMLElement | null;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const w = Math.min(0.9, Math.max(0.1, r.startW + (e.clientX - r.startX) / rect.width));
    const h = Math.min(0.9, Math.max(0.08, r.startH + (e.clientY - r.startY) / rect.height));
    const next = { ...card, w, h };
    pendingRef.current = next;
    onResize(next, false);
  };

  const onResizeUp = () => {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    onResize(pendingRef.current, true);
  };

  return (
    <div
      className={`notes-app__card${active ? ' notes-app__card--active' : ''}`}
      style={{
        left: `${card.x * 100}%`,
        top: `${card.y * 100}%`,
        width: `${card.w * 100}%`,
        height: `${card.h * 100}%`,
        background: card.color,
      }}
    >
      <div
        className="notes-app__card-head"
        onPointerDown={(e) => onDragStart(e, card)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerLeave={onDragEnd}
      >
        <span className="notes-app__card-grip" aria-hidden />
        <button
          type="button"
          className="notes-app__card-del"
          aria-label={deleteLabel}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card.id);
          }}
        >
          ×
        </button>
      </div>
      <div
        ref={editorRef}
        className="notes-app__card-text notes-app__card-editor"
        contentEditable={tool === 'card'}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onFocus={() => {
          focusedRef.current = true;
          onActivate(card.id, editorRef.current);
        }}
        onBlur={onBlur}
        onInput={onInput}
        onPointerDown={(e) => e.stopPropagation()}
      />
      {tool === 'card' ? (
        <div
          className="notes-app__card-resize"
          aria-label={resizeLabel}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerLeave={onResizeUp}
        />
      ) : null}
    </div>
  );
}
