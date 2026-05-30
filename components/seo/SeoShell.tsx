import Link from 'next/link';
import type { SeoLang } from '@/lib/seo/site';
import SiteFooter from '@/components/SiteFooter';
import '@/styles/seo.css';

type Props = {
  lang: SeoLang;
  children: React.ReactNode;
};

const nav = {
  pl: {
    home: 'Poradniki',
    app: 'Wyślij plik',
    pl: 'Polski',
    en: 'English',
  },
  en: {
    home: 'Guides',
    app: 'Send files',
    pl: 'Polski',
    en: 'English',
  },
};

export default function SeoShell({ lang, children }: Props) {
  const t = nav[lang];
  const other = lang === 'pl' ? 'en' : 'pl';

  return (
    <div className="seo-page">
      <header className="seo-header">
        <Link href={`/${lang}`} className="seo-logo">
          pliki.vxh.pl
        </Link>
        <nav className="seo-nav" aria-label={lang === 'pl' ? 'Nawigacja' : 'Navigation'}>
          <Link href={`/${lang}`}>{t.home}</Link>
          <Link href="/" className="seo-nav-cta">
            {t.app}
          </Link>
          <Link href="/pl" hrefLang="pl" lang="pl" className="seo-nav-lang">
            {t.pl}
          </Link>
          <Link href="/en" hrefLang="en" lang="en" className="seo-nav-lang">
            {t.en}
          </Link>
        </nav>
      </header>
      <main className="seo-main">{children}</main>
      <SiteFooter
        lang={lang}
        appMeta={
          <>
            © {new Date().getFullYear()} pliki.vxh.pl ·{' '}
            <Link href={other === 'pl' ? '/pl' : '/en'}>
              {lang === 'pl' ? 'Poradniki EN' : 'Poradniki PL'}
            </Link>
            {' · '}
            <Link href="/">{t.app}</Link>
          </>
        }
      />
    </div>
  );
}
