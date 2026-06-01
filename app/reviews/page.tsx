import type { Metadata } from 'next';
import Link from 'next/link';
import SeoReviewsList from '@/components/seo/SeoReviewsList';
import SeoShell from '@/components/seo/SeoShell';
import { buildReviewsMetadata, jsonLdBreadcrumb, jsonLdReviews } from '@/lib/seo/metadata';
import { getReviewsCopy } from '@/lib/seo/reviews';
import { SITE_URL } from '@/lib/seo/site';

export const metadata: Metadata = buildReviewsMetadata('pl');

export default function ReviewsPagePl() {
  const copy = getReviewsCopy('pl');
  const jsonLd = jsonLdReviews('pl');
  const breadcrumb = jsonLdBreadcrumb('pl', [
    { name: 'pliki.vxh.pl', url: SITE_URL },
    { name: copy.breadcrumb, url: `${SITE_URL}/reviews` },
  ]);

  return (
    <SeoShell lang="pl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <nav className="seo-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Aplikacja</Link>
        <span>/</span>
        <Link href="/pl">Poradniki</Link>
        <span>/</span>
        <span>{copy.breadcrumb}</span>
      </nav>
      <h1>{copy.h1}</h1>
      <p className="seo-lead">{copy.lead}</p>
      <div className="seo-cta-block">
        <Link href="/" className="seo-cta">
          {copy.openApp}
        </Link>
        <span className="seo-cta-hint">{copy.openAppHint}</span>
      </div>
      <SeoReviewsList lang="pl" />
      <p className="seo-footer-links">
        <Link href="/pl">{copy.allGuides}</Link>
        {' · '}
        <Link href="/en/reviews">English reviews</Link>
      </p>
    </SeoShell>
  );
}
