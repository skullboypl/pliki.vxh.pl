import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SeoFeaturesStrip from '@/components/seo/SeoFeaturesStrip';
import SeoTopicsHub from '@/components/seo/SeoTopicsHub';
import { getHubLabels } from '@/lib/seo/pages';
import { getHubSeoMeta } from '@/lib/seo/pageMeta';
import { buildHubMetadata, jsonLdWebPage } from '@/lib/seo/metadata';
import { hubUrl, isSeoLang, type SeoLang } from '@/lib/seo/site';

type Props = { params: Promise<{ lang: string }> };

export async function generateStaticParams() {
  return [{ lang: 'pl' }, { lang: 'en' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (!isSeoLang(lang)) return {};
  return buildHubMetadata(lang);
}

export default async function SeoHubPage({ params }: Props) {
  const { lang } = await params;
  if (!isSeoLang(lang)) notFound();
  const labels = getHubLabels(lang);
  const otherLang: SeoLang = lang === 'pl' ? 'en' : 'pl';
  const jsonLd = jsonLdWebPage(lang, labels.h1, getHubSeoMeta(lang).description, hubUrl(lang));

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
            ? 'Dwa urządzenia w tej samej sieci WiFi/LAN. HTTPS lub localhost.'
            : 'Two devices on the same WiFi/LAN. HTTPS or localhost.'}
        </span>
      </div>
      <SeoFeaturesStrip lang={lang} />
      <SeoTopicsHub lang={lang} heading={labels.allTopics} />
      <p className="seo-footer-links">
        <Link href={lang === 'pl' ? '/reviews' : '/en/reviews'}>
          {lang === 'pl' ? 'Opinie użytkowników' : 'User reviews'}
        </Link>
        {' · '}
        <Link href={`/${otherLang}`}>{labels.langSwitch}</Link>
      </p>
    </>
  );
}
