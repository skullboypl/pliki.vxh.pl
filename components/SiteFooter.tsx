import Link from 'next/link';
import { GITHUB_REPO_URL, type SeoLang } from '@/lib/seo/site';
import '@/styles/site-footer.css';

const STACK = ['Next.js', 'React', 'TypeScript', 'Socket.io', 'WebRTC'] as const;

const labels = {
  pl: { projectBy: 'Projekt:', guides: 'Poradniki', github: 'Kod na GitHubie' },
  en: { projectBy: 'Project by', guides: 'Guides', github: 'View on GitHub' },
};

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

type Props = {
  lang?: SeoLang;
  children?: React.ReactNode;
  appMeta?: React.ReactNode;
};

export default function SiteFooter({ lang = 'pl', children, appMeta }: Props) {
  const t = labels[lang];

  return (
    <footer className="site-footer">
      {children ? <div className="site-footer-actions">{children}</div> : null}
      {appMeta ? <p className="site-footer-app-meta">{appMeta}</p> : null}
      <p className="site-footer-credit">
        {t.projectBy}{' '}
        <a href="https://skullmedia.pl" target="_blank" rel="noopener noreferrer">
          skullmedia.pl
        </a>
      </p>
      <p className="site-footer-github-wrap">
        <a
          href={GITHUB_REPO_URL}
          className="site-footer-github-btn"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.github}
        >
          <GitHubIcon />
          <span>{t.github}</span>
        </a>
      </p>
      <p className="site-footer-stack" aria-label="Tech stack">
        {STACK.map((item, i) => (
          <span key={item}>
            {i > 0 ? <span className="site-footer-heart" aria-hidden>♥</span> : null}
            <span className="site-footer-stack-item">{item}</span>
          </span>
        ))}
      </p>
    </footer>
  );
}

export function SiteFooterAppMeta({
  lang,
  version,
  shortId,
}: {
  lang: SeoLang;
  version: string;
  shortId?: string;
}) {
  const t = labels[lang];
  return (
    <>
      <Link href={lang === 'pl' ? '/pl' : '/en'}>{t.guides}</Link>
      {' · '}
      pliki.vxh.pl · v{version}
      {shortId ? ` · #${shortId}` : ''}
    </>
  );
}
