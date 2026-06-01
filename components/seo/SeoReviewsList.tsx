'use client';

import { useMemo, useState } from 'react';
import StarRating from '@/components/seo/StarRating';
import { REVIEWS, getReviewsAggregate, getReviewsCopy } from '@/lib/seo/reviews';
import type { SeoLang } from '@/lib/seo/site';

type Props = {
  lang: SeoLang;
};

type SortId = 'newest' | 'rating';

export default function SeoReviewsList({ lang }: Props) {
  const copy = getReviewsCopy(lang);
  const agg = getReviewsAggregate();
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<SortId>('newest');

  const filtered = useMemo(() => {
    let list = [...REVIEWS];
    if (starFilter !== 'all') list = list.filter((r) => r.rating === starFilter);
    if (sort === 'rating') list.sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
    else list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [starFilter, sort]);

  return (
    <>
      <div className="seo-reviews-aggregate">
        <div className="seo-reviews-aggregate-score">
          <span className="seo-reviews-aggregate-value">{agg.average}</span>
          <StarRating value={agg.average} size={22} label={`${agg.average} / 5`} />
          <span className="seo-reviews-aggregate-meta">
            {agg.count} {copy.reviewsLabel}
            {agg.four > 0
              ? lang === 'pl'
                ? ` · ${agg.five}× 5★, ${agg.four}× 4★`
                : ` · ${agg.five}× 5★, ${agg.four}× 4★`
              : ` · ${agg.five} ${copy.fiveStars}`}
          </span>
        </div>
        <div className="seo-reviews-toolbar">
          <div className="seo-reviews-filters" role="group" aria-label={copy.filterAll}>
            <button
              type="button"
              className={`seo-topics-chip${starFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setStarFilter('all')}
            >
              {copy.filterAll}
            </button>
            {[5, 4].map((n) => (
              <button
                key={n}
                type="button"
                className={`seo-topics-chip${starFilter === n ? ' is-active' : ''}`}
                onClick={() => setStarFilter(n)}
              >
                {copy.filterStars.replace('{n}', String(n))}
              </button>
            ))}
          </div>
          <label className="seo-reviews-sort">
            <span className="seo-topics-toolbar-label">{lang === 'pl' ? 'Sortowanie' : 'Sort'}</span>
            <select
              className="seo-topics-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
            >
              <option value="newest">{copy.sortNewest}</option>
              <option value="rating">{copy.sortRating}</option>
            </select>
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="seo-topics-empty">{copy.empty}</p>
      ) : (
        <ul className="seo-reviews-list">
          {filtered.map((review) => (
            <li key={review.id} className="seo-review-card">
              <div className="seo-review-card-head">
                <StarRating value={review.rating} size={16} />
                {review.highlight ? (
                  <span className="seo-review-badge">{review.highlight[lang]}</span>
                ) : null}
              </div>
              <blockquote className="seo-review-quote">{review.quote[lang]}</blockquote>
              <footer className="seo-review-author">
                <strong>{review.author}</strong>
                <span className="seo-review-meta">
                  {review.role} · {review.device} · {review.date}
                </span>
              </footer>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
