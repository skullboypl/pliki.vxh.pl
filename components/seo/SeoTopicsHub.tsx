'use client';

import { useMemo, useState } from 'react';
import SeoTopicCard from '@/components/seo/SeoTopicCard';
import {
  SEO_CATEGORY_ORDER,
  getCategoryLabel,
  getHubTopicsUi,
  type SeoCategoryId,
  type SeoTopicSortId,
} from '@/lib/seo/categories';
import {
  buildHubTopicViews,
  filterHubTopics,
  groupTopicsByCategory,
  shouldGroupByCategory,
  sortHubTopics,
  type HubTopicView,
} from '@/lib/seo/hubTopics';
import { SEO_PAGES } from '@/lib/seo/pages';
import type { SeoLang } from '@/lib/seo/site';

type Props = {
  lang: SeoLang;
  heading: string;
};

export default function SeoTopicsHub({ lang, heading }: Props) {
  const ui = getHubTopicsUi(lang);
  const allTopics = useMemo(() => buildHubTopicViews(lang), [lang]);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SeoCategoryId | 'all'>('all');
  const [sort, setSort] = useState<SeoTopicSortId>('category');

  const filtered = useMemo(
    () => filterHubTopics(allTopics, query, category, lang),
    [allTopics, query, category, lang],
  );

  const hasSearch = query.trim().length > 0;
  const useGroups = shouldGroupByCategory(sort, category, hasSearch);

  const groups = useMemo(() => {
    if (!useGroups) return null;
    return groupTopicsByCategory(filtered, sort, lang);
  }, [filtered, sort, lang, useGroups]);

  const flatSorted = useMemo(() => {
    if (useGroups) return null;
    return sortHubTopics(filtered, sort, lang);
  }, [filtered, sort, lang, useGroups]);

  const resultLabel =
    filtered.length === 1
      ? ui.resultsCountOne
      : ui.resultsCount.replace('{count}', String(filtered.length));

  const pageById = useMemo(() => new Map(SEO_PAGES.map((p) => [p.id, p])), []);

  const renderCard = (topic: HubTopicView) => {
    const page = pageById.get(topic.id);
    if (!page) return null;
    return (
      <li key={topic.id}>
        <SeoTopicCard page={page} lang={lang} />
      </li>
    );
  };

  return (
    <section className="seo-topics-hub" aria-labelledby="seo-topics-hub-heading">
      <h2 id="seo-topics-hub-heading" className="seo-hub-heading">
        {heading}
      </h2>

      <div className="seo-topics-toolbar">
        <label className="seo-topics-search">
          <span className="seo-topics-toolbar-label">{ui.searchLabel}</span>
          <span className="seo-topics-search-row">
            <input
              type="search"
              className="seo-topics-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ui.searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button
                type="button"
                className="seo-topics-search-clear"
                onClick={() => setQuery('')}
              >
                {ui.clearSearch}
              </button>
            ) : null}
          </span>
        </label>

        <div className="seo-topics-toolbar-row">
          <div className="seo-topics-control">
            <span className="seo-topics-toolbar-label" id="seo-topics-sort-label">
              {ui.sortLabel}
            </span>
            <select
              className="seo-topics-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SeoTopicSortId)}
              aria-labelledby="seo-topics-sort-label"
            >
              <option value="category">{ui.sortCategory}</option>
              <option value="recommended">{ui.sortRecommended}</option>
              <option value="title-asc">{ui.sortTitleAsc}</option>
              <option value="title-desc">{ui.sortTitleDesc}</option>
            </select>
          </div>
          <p className="seo-topics-count" aria-live="polite">
            {resultLabel}
          </p>
        </div>
      </div>

      <div
        className="seo-topics-categories"
        role="group"
        aria-label={ui.categoryLabel}
      >
        <button
          type="button"
          className={`seo-topics-chip${category === 'all' ? ' is-active' : ''}`}
          onClick={() => setCategory('all')}
        >
          {ui.categoryAll}
        </button>
        {SEO_CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`seo-topics-chip${category === cat ? ' is-active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {getCategoryLabel(cat, lang)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="seo-topics-empty">{ui.empty}</p>
      ) : useGroups && groups ? (
        <div className="seo-topics-grouped">
          {groups.map((group) => (
            <section
              key={group.category}
              className="seo-topics-group"
              aria-labelledby={`seo-cat-${group.category}`}
            >
              <h3 id={`seo-cat-${group.category}`} className="seo-topics-group-title">
                {getCategoryLabel(group.category, lang)}
                <span className="seo-topics-group-count">{group.topics.length}</span>
              </h3>
              <ul className="seo-topics">{group.topics.map(renderCard)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="seo-topics">{flatSorted?.map(renderCard)}</ul>
      )}
    </section>
  );
}
