import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

/** Plik zaczyna się od pełnego dokumentu HTML. */
function startsWithHtmlDocument(text: string) {
  const head = text.trim().slice(0, 200);
  return /^<!DOCTYPE\s+html/i.test(head) || /^<html[\s>]/i.test(head) || /^<body[\s>]/i.test(head);
}

/** Wyraźne sygnały Markdown — wtedy parsujemy MD, nawet jeśli dalej jest HTML. */
function hasMarkdownFeatures(text: string) {
  const sample = text.slice(0, 4000);
  return (
    /^#{1,6}\s+\S/m.test(sample) ||
    /^[-*+]\s+\S/m.test(sample) ||
    /^```/m.test(sample) ||
    /^\|.+\|/m.test(sample) ||
    /\[.+?\]\(.+?\)/.test(sample) ||
    /\*\*.+\*\*/.test(sample) ||
    /^>\s+\S/m.test(sample)
  );
}

/** Samodzielny fragment HTML (bez Markdown na początku). */
function isHtmlFragment(text: string) {
  const trimmed = text.trim();
  if (/^#{1,6}\s/.test(trimmed)) return false;
  const firstLine = trimmed.split('\n').find((line) => line.trim())?.trim() || '';
  return /^<[a-z][\w-]*[\s>\/]/i.test(firstLine);
}

export function shouldRenderAsHtml(text: string) {
  const trimmed = text.trim();
  if (hasMarkdownFeatures(trimmed)) return false;
  return startsWithHtmlDocument(trimmed) || isHtmlFragment(trimmed);
}

export function looksLikeHtml(text: string) {
  return shouldRenderAsHtml(text);
}

export function renderNoteContent(text: string) {
  const trimmed = text.trim();
  const raw = shouldRenderAsHtml(trimmed) ? trimmed : marked.parse(trimmed, { async: false });
  const html = DOMPurify.sanitize(String(raw), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });

  if (typeof document === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('a[href]').forEach((anchor) => {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  });
  return doc.body.innerHTML;
}
