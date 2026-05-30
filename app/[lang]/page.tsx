import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getHubLabels, SEO_PAGES, getSlug } from '@/lib/seo/pages';
import { buildHubMetadata, jsonLdWebPage } from '@/lib/seo/metadata';
import { hubUrl, isSeoLang, type SeoLang } from '@/lib/seo/site';

type Props = { params: Promise<{ lang: string }> };

export async function generateStaticParams() {
  return [{ lang: 'pl' }, { lang: 'en' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isSeoLang(lang)) return {};
  const labels = getHubLabels(lang);
  return buildHubMetadata(lang, labels.title, labels.description);
}

export default async function SeoHubPage({ params }: Props) {
  const { lang } = await params;
  if (!isSeoLang(lang)) notFound();
  const labels = getHubLabels(lang);
  const otherLang: SeoLang = lang === 'pl' ? 'en' : 'pl';
  const jsonLd = jsonLdWebPage(lang, labels.h1, labels.description, hubUrl(lang));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="seo-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">{lang === 'pl' ? 'Aplikacja' : 'App'}</Link>
        <span>/</span>
        <span>{lang === 'pl' ? 'Poradniki' : 'Guides'}</span>
      </nav>
      <h1>{labels.h1}</h1>
      <p className="seo-lead">{labels.intro}</p>
      <div className="seo-cta-block">
        <Link href="/" className="seo-cta">
          {labels.openApp}
        </Link>
        <span className="seo-cta-hint">
          {lang === 'pl'
            ? 'Ta sama sieć WiFi na dwóch urządzeniach.'
            : 'Same WiFi on two devices.'}
        </span>
      </div>
      <h2 className="seo-hub-heading">{labels.allTopics}</h2>
      <ul className="seo-topics">
        {SEO_PAGES.map((page) => (
          <li key={page.id}>
            <Link href={`/${lang}/${getSlug(page, lang)}`} className="seo-topic-card">
              <strong>{page.h1[lang]}</strong>
              <span>{page.description[lang]}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="seo-footer-links">
        <Link href={`/${otherLang}`}>{labels.langSwitch}</Link>
      </p>
    </>
  );
}
