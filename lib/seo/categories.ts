import type { SeoLang } from '@/lib/seo/site';

export type SeoCategoryId = 'start' | 'features' | 'network' | 'devices' | 'use-cases' | 'files';

export type SeoTopicSortId = 'recommended' | 'title-asc' | 'title-desc' | 'category';

/** Kolejność kategorii na liście (gdy sortowanie po kategorii). */
export const SEO_CATEGORY_ORDER: SeoCategoryId[] = [
  'start',
  'features',
  'network',
  'devices',
  'use-cases',
  'files',
];

export const TOPIC_HUB_META: Record<
  string,
  { category: SeoCategoryId; hubOrder: number }
> = {
  'send-wifi': { category: 'start', hubOrder: 1 },
  'how-it-works': { category: 'start', hubOrder: 2 },
  'no-account': { category: 'start', hubOrder: 3 },
  faq: { category: 'start', hubOrder: 4 },
  'drag-drop': { category: 'features', hubOrder: 10 },
  'file-bundles': { category: 'features', hubOrder: 11 },
  'camera-share': { category: 'features', hubOrder: 12 },
  'lan-transfer': { category: 'network', hubOrder: 20 },
  'p2p-offline': { category: 'network', hubOrder: 21 },
  'fast-wifi': { category: 'network', hubOrder: 22 },
  'privacy-local': { category: 'network', hubOrder: 23 },
  'security-p2p': { category: 'network', hubOrder: 24 },
  'vs-cloud': { category: 'network', hubOrder: 25 },
  'phone-pc': { category: 'devices', hubOrder: 30 },
  'android-iphone': { category: 'devices', hubOrder: 31 },
  'iphone-safari': { category: 'devices', hubOrder: 32 },
  'pwa-install': { category: 'devices', hubOrder: 33 },
  'office-lan': { category: 'use-cases', hubOrder: 40 },
  'home-network': { category: 'use-cases', hubOrder: 41 },
  'photos-no-cloud': { category: 'files', hubOrder: 50 },
  'large-video': { category: 'files', hubOrder: 51 },
  'documents-pdf': { category: 'files', hubOrder: 52 },
  'music-files': { category: 'files', hubOrder: 53 },
};

export function getTopicHubMeta(pageId: string) {
  return (
    TOPIC_HUB_META[pageId] ?? { category: 'start' as SeoCategoryId, hubOrder: 999 }
  );
}

export function getCategoryLabel(category: SeoCategoryId, lang: SeoLang) {
  const labels = lang === 'pl' ? CATEGORY_LABELS_PL : CATEGORY_LABELS_EN;
  return labels[category];
}

const CATEGORY_LABELS_PL: Record<SeoCategoryId, string> = {
  start: 'Start i podstawy',
  features: 'Funkcje aplikacji',
  network: 'Sieć i prywatność',
  devices: 'Urządzenia i PWA',
  'use-cases': 'Dom i biuro',
  files: 'Typy plików',
};

const CATEGORY_LABELS_EN: Record<SeoCategoryId, string> = {
  start: 'Getting started',
  features: 'App features',
  network: 'Network and privacy',
  devices: 'Devices and PWA',
  'use-cases': 'Home and office',
  files: 'File types',
};

export function getHubTopicsUi(lang: SeoLang) {
  return lang === 'pl'
    ? {
        searchLabel: 'Szukaj tematów',
        searchPlaceholder: 'np. iPhone, paczka, LAN…',
        categoryLabel: 'Kategoria',
        categoryAll: 'Wszystkie',
        sortLabel: 'Sortowanie',
        sortRecommended: 'Polecane',
        sortTitleAsc: 'Tytuł A–Z',
        sortTitleDesc: 'Tytuł Z–A',
        sortCategory: 'Według kategorii',
        resultsCount: '{count} tematów',
        resultsCountOne: '1 temat',
        empty: 'Brak tematów dla tego wyszukiwania. Zmień frazę lub kategorię.',
        clearSearch: 'Wyczyść',
      }
    : {
        searchLabel: 'Search topics',
        searchPlaceholder: 'e.g. iPhone, bundle, LAN…',
        categoryLabel: 'Category',
        categoryAll: 'All',
        sortLabel: 'Sort',
        sortRecommended: 'Recommended',
        sortTitleAsc: 'Title A–Z',
        sortTitleDesc: 'Title Z–A',
        sortCategory: 'By category',
        resultsCount: '{count} topics',
        resultsCountOne: '1 topic',
        empty: 'No topics match. Try another phrase or category.',
        clearSearch: 'Clear',
      };
}
