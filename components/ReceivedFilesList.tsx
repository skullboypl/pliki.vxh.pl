'use client';

import { useMemo, useState } from 'react';
import DownloadThumb, { hasListThumb, isAudioLink, isTextLink } from '@/components/DownloadThumb';
import ZipListThumb from '@/components/ZipListThumb';
import { downloadAllFiles, downloadBundleAsZip } from '@/lib/bundleDownload';
import { isVxhTextNote } from '@/lib/textNote';

export type ReceivedFile = {
  id: number;
  fileName: string;
  url: string;
  peerName: string;
  mime: string;
  size?: number;
  file?: File;
  isNew?: boolean;
  batchId?: string;
  batchIndex?: number;
  batchTotal?: number;
  receivedAt: number;
  /** OPFS staging file name — removed when user deletes the item from the list. */
  opfsEntryName?: string;
};

type Lang = 'pl' | 'en';
type SortKey = 'newest' | 'oldest' | 'nameAsc' | 'nameDesc' | 'sizeDesc';
type FilterKey = 'all' | 'single' | 'bundle';

type Props = {
  lang: Lang;
  links: ReceivedFile[];
  displayName: (name: string) => string;
  isPreviewable: (link: ReceivedFile) => boolean;
  isZipListable?: (link: ReceivedFile) => boolean;
  zipListLabel?: string;
  onSave: (link: ReceivedFile) => void;
  onMarkSaved: (ids: number[]) => void;
  onPreview: (link: ReceivedFile) => void;
  onZipList?: (link: ReceivedFile) => void;
  onDelete: (id: number) => void;
  onDeleteBundle?: (ids: number[]) => void;
  onDeleteAll?: () => void;
  deleteAllLabel?: string;
};

const COPY = {
  pl: {
    filterAll: 'Wszystkie',
    filterSingle: 'Pojedyncze',
    filterBundle: 'Paczki',
    sortNewest: 'Najnowsze',
    sortOldest: 'Najstarsze',
    sortNameAsc: 'Nazwa A–Z',
    sortNameDesc: 'Nazwa Z–A',
    sortSizeDesc: 'Największe',
    filterLabel: 'Pokaż',
    sortLabel: 'Sortuj',
    fromWho: 'Od: {name}',
    saveFile: 'Zapisz plik',
    saveFileShort: 'Zapisz',
    saveZip: 'Pobierz ZIP',
    saveAll: 'Pobierz wszystkie',
    savingZip: 'Pakowanie…',
    zipError: 'Nie udało się utworzyć ZIP.',
    showBTN: 'Podgląd',
    listenBTN: 'Odtwórz',
    readBTN: 'Odczytaj',
    newFile: 'Nowy plik!',
    bundleTitle: 'Paczka · {count} plików',
    bundleOne: 'Paczka · 1 plik',
    expand: 'Rozwiń',
    collapse: 'Zwiń',
    deleteBundle: 'Usuń całą paczkę',
    emptyFilter: 'Brak plików dla wybranego filtra.',
  },
  en: {
    filterAll: 'All',
    filterSingle: 'Single files',
    filterBundle: 'Bundles',
    sortNewest: 'Newest',
    sortOldest: 'Oldest',
    sortNameAsc: 'Name A–Z',
    sortNameDesc: 'Name Z–A',
    sortSizeDesc: 'Largest',
    filterLabel: 'Show',
    sortLabel: 'Sort',
    fromWho: 'From: {name}',
    saveFile: 'Save file',
    saveFileShort: 'Save',
    saveZip: 'Download ZIP',
    saveAll: 'Download all',
    savingZip: 'Zipping…',
    zipError: 'Could not create ZIP.',
    showBTN: 'Preview',
    listenBTN: 'Play',
    readBTN: 'Read',
    newFile: 'New file!',
    bundleTitle: 'Bundle · {count} files',
    bundleOne: 'Bundle · 1 file',
    expand: 'Expand',
    collapse: 'Collapse',
    deleteBundle: 'Remove entire bundle',
    emptyFilter: 'No files match this filter.',
  },
} as const;

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatReceivedAt = (ms: number, lang: Lang) => {
  if (!ms) return '';
  const tag = lang === 'pl' ? 'pl-PL' : 'en-GB';
  return new Date(ms).toLocaleString(tag, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type BundleGroup = {
  kind: 'bundle';
  batchId: string;
  links: ReceivedFile[];
  receivedAt: number;
  totalSize: number;
  peerName: string;
  hasNew: boolean;
};

type SingleItem = {
  kind: 'single';
  link: ReceivedFile;
  sortKey: number | string;
};

type DisplayItem = BundleGroup | SingleItem;

function isBundleLink(link: ReceivedFile) {
  return !!(link.batchId && link.batchTotal && link.batchTotal > 1);
}

function buildDisplayItems(links: ReceivedFile[], filter: FilterKey, sort: SortKey): DisplayItem[] {
  let filtered = links;
  if (filter === 'single') filtered = links.filter((l) => !isBundleLink(l));
  if (filter === 'bundle') filtered = links.filter((l) => isBundleLink(l));

  const bundleMap = new Map<string, ReceivedFile[]>();
  const singles: ReceivedFile[] = [];

  for (const link of filtered) {
    if (isBundleLink(link) && link.batchId) {
      const list = bundleMap.get(link.batchId) || [];
      list.push(link);
      bundleMap.set(link.batchId, list);
    } else {
      singles.push(link);
    }
  }

  const items: DisplayItem[] = [];

  for (const link of singles) {
    items.push({
      kind: 'single',
      link,
      sortKey: sort === 'nameAsc' || sort === 'nameDesc' ? link.fileName.toLowerCase() : link.receivedAt,
    });
  }

  for (const [batchId, batchLinks] of bundleMap) {
    const sorted = [...batchLinks].sort(
      (a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0) || a.receivedAt - b.receivedAt,
    );
    const receivedAt = Math.max(...sorted.map((l) => l.receivedAt));
    const totalSize = sorted.reduce((n, l) => n + (l.size || 0), 0);
    items.push({
      kind: 'bundle',
      batchId,
      links: sorted,
      receivedAt,
      totalSize,
      peerName: sorted[0]?.peerName || '',
      hasNew: sorted.some((l) => l.isNew),
    });
  }

  const cmp = (a: DisplayItem, b: DisplayItem) => {
    if (sort === 'nameAsc' || sort === 'nameDesc') {
      const nameA =
        a.kind === 'single'
          ? a.link.fileName.toLowerCase()
          : a.links[0]?.fileName.toLowerCase() || '';
      const nameB =
        b.kind === 'single'
          ? b.link.fileName.toLowerCase()
          : b.links[0]?.fileName.toLowerCase() || '';
      return sort === 'nameAsc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    }
    if (sort === 'sizeDesc') {
      const sizeA = a.kind === 'single' ? a.link.size || 0 : a.totalSize;
      const sizeB = b.kind === 'single' ? b.link.size || 0 : b.totalSize;
      return sizeB - sizeA;
    }
    const timeA = a.kind === 'single' ? a.link.receivedAt : a.receivedAt;
    const timeB = b.kind === 'single' ? b.link.receivedAt : b.receivedAt;
    return sort === 'oldest' ? timeA - timeB : timeB - timeA;
  };

  items.sort(cmp);
  return items;
}

function IconFolder({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function ReceivedFilesList({
  lang,
  links,
  displayName,
  isPreviewable,
  isZipListable,
  zipListLabel,
  onSave,
  onMarkSaved,
  onPreview,
  onZipList,
  onDelete,
  onDeleteBundle,
  onDeleteAll,
  deleteAllLabel,
}: Props) {
  const t = COPY[lang];
  const [filter, setFilter] = useState<FilterKey>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [zipBusyId, setZipBusyId] = useState<string | null>(null);
  const [zipErrorId, setZipErrorId] = useState<string | null>(null);

  const showToolbar = links.length >= 2;
  const items = useMemo(() => buildDisplayItems(links, filter, sort), [links, filter, sort]);

  const toggleBundle = (batchId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  const saveAll = (batchLinks: ReceivedFile[]) => {
    downloadAllFiles(batchLinks, onSave);
  };

  const saveAsZip = async (batchId: string, batchLinks: ReceivedFile[]) => {
    setZipBusyId(batchId);
    setZipErrorId(null);
    try {
      await downloadBundleAsZip(batchLinks);
      onMarkSaved(batchLinks.map((l) => l.id));
    } catch {
      setZipErrorId(batchId);
      window.setTimeout(() => {
        setZipErrorId((id) => (id === batchId ? null : id));
      }, 4500);
    } finally {
      setZipBusyId(null);
    }
  };

  const renderFileRow = (link: ReceivedFile, nested = false) => (
    <div key={link.id} className={`download-row ${link.isNew ? 'is-new' : ''}${nested ? ' download-row-nested' : ''}`}>
      <div className="download-row-main">
        {isZipListable?.(link) && onZipList && zipListLabel ? (
          <button
            type="button"
            className="download-thumb download-thumb--zip"
            onClick={() => void onZipList(link)}
            aria-label={zipListLabel}
          >
            <ZipListThumb
              url={link.url}
              file={link.file}
              size={link.size}
              lang={lang}
            />
          </button>
        ) : hasListThumb(link) ? (
          <button
            type="button"
            className="download-thumb"
            onClick={() => onPreview(link)}
            aria-label={
              isTextLink(link) ? t.readBTN : isAudioLink(link) ? t.listenBTN : t.showBTN
            }
          >
            <DownloadThumb link={link} />
          </button>
        ) : null}
        <div className="download-row-body">
          {link.isNew && <span className="new-badge">{t.newFile}</span>}
          <div className="download-name">{link.fileName}</div>
          <div className="download-meta">
            {link.size ? formatSize(link.size) : ''}
            {!nested && (
              <>
                {' · '}
                {t.fromWho.replace('{name}', displayName(link.peerName))}
                {link.receivedAt ? (
                  <>
                    {' · '}
                    <time dateTime={new Date(link.receivedAt).toISOString()}>
                      {formatReceivedAt(link.receivedAt, lang)}
                    </time>
                  </>
                ) : null}
              </>
            )}
            {nested && link.batchIndex && link.batchTotal ? (
              <span className="download-batch-pos">
                {' · '}
                {link.batchIndex}/{link.batchTotal}
              </span>
            ) : null}
          </div>
          <div className="download-btns">
            <button type="button" className={`btn-save${nested ? ' btn-save-compact' : ''}`} onClick={() => onSave(link)}>
              {nested ? t.saveFileShort : t.saveFile}
            </button>
            {isZipListable?.(link) && onZipList && zipListLabel ? (
              <button type="button" className="btn-ghost" onClick={() => void onZipList(link)}>
                {zipListLabel}
              </button>
            ) : null}
            {isPreviewable(link) && (
              <button type="button" className="btn-ghost" onClick={() => onPreview(link)}>
                {isAudioLink(link)
                  ? t.listenBTN
                  : isVxhTextNote(link.fileName)
                    ? t.readBTN
                    : t.showBTN}
              </button>
            )}
            <button type="button" className="btn-ghost danger" onClick={() => onDelete(link.id)}>
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!links.length) return null;

  return (
    <>
      {showToolbar && (
        <div className="downloads-toolbar">
          <label className="downloads-control">
            <span className="downloads-control-label">{t.filterLabel}</span>
            <select
              className="downloads-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterKey)}
            >
              <option value="all">{t.filterAll}</option>
              <option value="single">{t.filterSingle}</option>
              <option value="bundle">{t.filterBundle}</option>
            </select>
          </label>
          <label className="downloads-control">
            <span className="downloads-control-label">{t.sortLabel}</span>
            <select
              className="downloads-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="newest">{t.sortNewest}</option>
              <option value="oldest">{t.sortOldest}</option>
              <option value="nameAsc">{t.sortNameAsc}</option>
              <option value="nameDesc">{t.sortNameDesc}</option>
              <option value="sizeDesc">{t.sortSizeDesc}</option>
            </select>
          </label>
        </div>
      )}

      {items.length === 0 ? (
        <p className="downloads-empty-filter">{t.emptyFilter}</p>
      ) : (
        items.map((item) => {
          if (item.kind === 'single') {
            return renderFileRow(item.link);
          }

          const open = !collapsed.has(item.batchId);
          const count = item.links.length;
          const title =
            count === 1
              ? t.bundleOne
              : t.bundleTitle.replace('{count}', String(count));

          return (
            <div
              key={item.batchId}
              className={`download-bundle${item.hasNew ? ' is-new' : ''}${open ? ' is-open' : ' is-collapsed'}`}
            >
              <div className="download-bundle-head">
                <div className="download-bundle-head-row">
                  <button
                    type="button"
                    className="download-bundle-toggle"
                    onClick={() => toggleBundle(item.batchId)}
                    aria-expanded={open}
                    aria-label={open ? t.collapse : t.expand}
                  >
                    <IconChevron open={open} />
                    <span className="download-bundle-icon" aria-hidden>
                      <IconFolder />
                    </span>
                    <span className="download-bundle-title">{title}</span>
                  </button>
                  {onDeleteBundle ? (
                    <button
                      type="button"
                      className="btn-ghost danger download-bundle-delete"
                      onClick={() => onDeleteBundle(item.links.map((l) => l.id))}
                      aria-label={t.deleteBundle}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                <div className="download-bundle-meta">
                  {formatSize(item.totalSize)} · {t.fromWho.replace('{name}', displayName(item.peerName))}
                  {item.receivedAt ? (
                    <>
                      {' · '}
                      <time dateTime={new Date(item.receivedAt).toISOString()}>
                        {formatReceivedAt(item.receivedAt, lang)}
                      </time>
                    </>
                  ) : null}
                </div>
                <div className="download-bundle-actions">
                  <button
                    type="button"
                    className="btn-save btn-save-compact"
                    disabled={zipBusyId === item.batchId}
                    onClick={() => saveAsZip(item.batchId, item.links)}
                  >
                    {zipBusyId === item.batchId ? t.savingZip : t.saveZip}
                  </button>
                  <button
                    type="button"
                    className="btn-save btn-save-compact btn-save-outline"
                    disabled={zipBusyId === item.batchId}
                    onClick={() => saveAll(item.links)}
                  >
                    {t.saveAll}
                  </button>
                </div>
              </div>
              {zipErrorId === item.batchId ? (
                <p className="download-bundle-error" role="alert">
                  {t.zipError}
                </p>
              ) : null}
              {open && <div className="download-bundle-body">{item.links.map((link) => renderFileRow(link, true))}</div>}
            </div>
          );
        })
      )}

      {onDeleteAll && deleteAllLabel ? (
        <div className="downloads-delete-all">
          <button type="button" className="downloads-delete-all-btn" onClick={onDeleteAll}>
            {deleteAllLabel}
          </button>
        </div>
      ) : null}
    </>
  );
}
