import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  SEO_PAGES,
  findPageBySlug,
  getAllStaticParams,
  getSlug,
  getAlternateSlug,
} from '@/lib/seo/pages';
import { buildPageMetadata, jsonLdWebPage } from '@/lib/seo/metadata';
import { isSeoLang, pageUrl, type SeoLang } from '@/lib/seo/site';

type Props = { params: Promise<{ lang: string; slug: string }> };

export function generateStaticParams() {
  return getAllStaticParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isSeoLang(lang)) return {};
  const page = findPageBySlug(lang, slug);
  if (!page) return {};
  return buildPageMetadata(page, lang);
}

export default async function SeoArticlePage({ params }: Props) {
  const { lang, slug } = await params;
  if (!isSeoLang(lang)) notFound();

  const page = findPageBySlug(lang, slug);
  if (!page) notFound();

  const otherLang: SeoLang = lang === 'pl' ? 'en' : 'pl';
  const url = pageUrl(lang, slug);
  const jsonLd = jsonLdWebPage(lang, page.h1[lang], page.description[lang], url);

  const related = SEO_PAGES.filter((p) => p.id !== page.id).slice(0, 6);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article>
        <nav className="seo-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">{lang === 'pl' ? 'Aplikacja' : 'App'}</Link>
          <span>/</span>
          <Link href={`/${lang}`}>{lang === 'pl' ? 'Poradniki' : 'Guides'}</Link>
          <span>/</span>
          <span>{page.h1[lang]}</span>
        </nav>
        <h1>{page.h1[lang]}</h1>
        <p className="seo-lead">{page.description[lang]}</p>
        {page.sections[lang].map((section) => (
          <section key={section.title} className="seo-section">
            <h2>{section.title}</h2>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </section>
        ))}
        <div className="seo-cta-block">
          <Link href="/" className="seo-cta">
            {lang === 'pl' ? 'Otwórz aplikację i wyślij plik' : 'Open the app and send a file'}
          </Link>
          <span className="seo-cta-hint">
            {lang === 'pl' ? 'Działa w przeglądarce, bez instalacji.' : 'Works in the browser, no install.'}
          </span>
        </div>
        <nav className="seo-related" aria-label={lang === 'pl' ? 'Powiązane tematy' : 'Related topics'}>
          <h2>{lang === 'pl' ? 'Zobacz też' : 'See also'}</h2>
          <ul>
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/${lang}/${getSlug(r, lang)}`}>{r.h1[lang]}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="seo-footer-links">
          <Link href={`/${lang}`}>{lang === 'pl' ? 'Wszystkie poradniki' : 'All guides'}</Link>
          {' · '}
          <Link href={`/${otherLang}/${getAlternateSlug(page, lang)}`}>
            {lang === 'pl' ? 'Wersja angielska' : 'Polish version'}
          </Link>
        </p>
      </article>
    </>
  );
}
