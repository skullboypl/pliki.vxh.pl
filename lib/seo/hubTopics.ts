import {
  SEO_CATEGORY_ORDER,
  getCategoryLabel,
  getTopicHubMeta,
  type SeoCategoryId,
  type SeoTopicSortId,
} from '@/lib/seo/categories';
import { SEO_PAGES, getSlug, type SeoPage } from '@/lib/seo/pages';
import type { SeoLang } from '@/lib/seo/site';

export type HubTopicView = {
  id: string;
  icon: SeoPage['icon'];
  category: SeoCategoryId;
  hubOrder: number;
  h1: string;
  description: string;
  slug: string;
  keywords: string[];
};

export function buildHubTopicViews(lang: SeoLang): HubTopicView[] {
  return SEO_PAGES.map((page) => {
    const meta = getTopicHubMeta(page.id);
    return {
      id: page.id,
      icon: page.icon,
      category: meta.category,
      hubOrder: meta.hubOrder,
      h1: page.h1[lang],
      description: page.description[lang],
      slug: getSlug(page, lang),
      keywords: page.keywords[lang],
    };
  });
}

export function topicSearchHaystack(topic: HubTopicView, lang: SeoLang) {
  return [
    topic.h1,
    topic.description,
    topic.slug,
    getCategoryLabel(topic.category, lang),
    ...topic.keywords,
  ]
    .join(' ')
    .toLowerCase();
}

export function filterHubTopics(
  topics: HubTopicView[],
  query: string,
  category: SeoCategoryId | 'all',
  lang: SeoLang,
) {
  const q = query.trim().toLowerCase();
  return topics.filter((t) => {
    if (category !== 'all' && t.category !== category) return false;
    if (!q) return true;
    return topicSearchHaystack(t, lang).includes(q);
  });
}

export function sortHubTopics(topics: HubTopicView[], sort: SeoTopicSortId, lang: SeoLang) {
  const list = [...topics];
  if (sort === 'title-asc') {
    return list.sort((a, b) => a.h1.localeCompare(b.h1, lang));
  }
  if (sort === 'title-desc') {
    return list.sort((a, b) => b.h1.localeCompare(a.h1, lang));
  }
  if (sort === 'category') {
    return list.sort((a, b) => {
      const ca = SEO_CATEGORY_ORDER.indexOf(a.category);
      const cb = SEO_CATEGORY_ORDER.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return a.hubOrder - b.hubOrder;
    });
  }
  return list.sort((a, b) => a.hubOrder - b.hubOrder);
}

export function groupTopicsByCategory(
  topics: HubTopicView[],
  sort: SeoTopicSortId,
  lang: SeoLang,
) {
  const sorted = sortHubTopics(topics, sort, lang);
  const groups: { category: SeoCategoryId; topics: HubTopicView[] }[] = [];
  for (const cat of SEO_CATEGORY_ORDER) {
    const inCat = sorted.filter((t) => t.category === cat);
    if (inCat.length) groups.push({ category: cat, topics: inCat });
  }
  return groups;
}

export function shouldGroupByCategory(
  sort: SeoTopicSortId,
  categoryFilter: SeoCategoryId | 'all',
  hasSearch: boolean,
) {
  return sort === 'category' && categoryFilter === 'all' && !hasSearch;
}
