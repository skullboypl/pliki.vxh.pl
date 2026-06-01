import type { Metadata } from 'next';
import Link from 'next/link';
import SeoReviewsList from '@/components/seo/SeoReviewsList';
import SeoShell from '@/components/seo/SeoShell';
import { buildReviewsMetadata, jsonLdBreadcrumb, jsonLdReviews } from '@/lib/seo/metadata';
import { getReviewsCopy } from '@/lib/seo/reviews';
import { SITE_URL } from '@/lib/seo/site';

export const metadata: Metadata = buildReviewsMetadata('en');

export default function ReviewsPageEn() {
  const copy = getReviewsCopy('en');
  const jsonLd = jsonLdReviews('en');
  const breadcrumb = jsonLdBreadcrumb('en', [
    { name: 'pliki.vxh.pl', url: SITE_URL },
    { name: copy.breadcrumb, url: `${SITE_URL}/en/reviews` },
  ]);

  return (
    <SeoShell lang="en">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <nav className="seo-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">App</Link>
        <span>/</span>
        <Link href="/en">Guides</Link>
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
      <SeoReviewsList lang="en" />
      <p className="seo-footer-links">
        <Link href="/en">{copy.allGuides}</Link>
        {' · '}
        <Link href="/reviews">Opinie PL</Link>
      </p>
    </SeoShell>
  );
}
