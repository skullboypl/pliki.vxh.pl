import Link from 'next/link';
import { AUTHOR_SOCIALS, authorSocialAria } from '@/lib/authorSocials';
import { GITHUB_REPO_URL, type SeoLang } from '@/lib/seo/site';
import '@/styles/site-footer.css';

const STACK = ['Next.js', 'React', 'TypeScript', 'Socket.io', 'WebRTC'] as const;

const labels = {
  pl: { projectBy: 'Projekt:', guides: 'Poradniki', github: 'Kod na GitHubie' },
  en: { projectBy: 'Project by', guides: 'Guides', github: 'View on GitHub' },
};

function SocialIcon({ id }: { id: string }) {
  switch (id) {
    case 'youtube':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.75 15.02V8.98L15.5 12l-5.75 3.02Z"
          />
        </svg>
      );
    case 'tiktok':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1.01-.07Z"
          />
        </svg>
      );
    case 'twitch':
      return (
        <svg width="18" height="18" viewBox="0 0 50 50" aria-hidden>
          <path
            fill="currentColor"
            d="M 5.3125 1 L 2 9.8125 L 2 43 L 13 43 L 13 49 L 20.40625 49 L 26.40625 43 L 35.40625 43 L 48 30.4375 L 48 1 Z M 11 6 L 43 6 L 43 28 L 37 34 L 25 34 L 19 40 L 19 34 L 11 34 Z M 20 13 L 20 27 L 26 27 L 26 13 Z M 30 13 L 30 27 L 36 27 L 36 13 Z"
          />
        </svg>
      );
    case 'instagram':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.74 3.74 0 0 1-1.38-.9 3.74 3.74 0 0 1-.9-1.38c-.16-.43-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07ZM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.15.63c-.78.3-1.44.7-2.1 1.36A5.48 5.48 0 0 0 .63 4.15C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.9.3.78.7 1.44 1.36 2.1.66.66 1.32 1.06 2.1 1.36.75.3 1.63.5 2.9.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.9-.56.78-.3 1.44-.7 2.1-1.36.66-.66 1.06-1.32 1.36-2.1.3-.75.5-1.63.56-2.9.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.9a5.48 5.48 0 0 0-1.36-2.1A5.48 5.48 0 0 0 19.85.63c-.75-.3-1.63-.5-2.9-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.41-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88Z"
          />
        </svg>
      );
    case 'discord':
      return (
        <svg width="18" height="18" viewBox="0 0 50 50" aria-hidden>
          <path
            fill="currentColor"
            fillRule="nonzero"
            d="M41.625,10.76953c-3.98047,-3.20313 -10.27734,-3.74609 -10.54687,-3.76563c-0.41797,-0.03516 -0.81641,0.19922 -0.98828,0.58594c-0.01562,0.02344 -0.15234,0.33984 -0.30469,0.83203c2.63281,0.44531 5.86719,1.33984 8.79297,3.15625c0.46875,0.28906 0.61328,0.90625 0.32422,1.375c-0.19141,0.30859 -0.51562,0.47656 -0.85156,0.47656c-0.17969,0 -0.36328,-0.05078 -0.52734,-0.15234c-5.03125,-3.12109 -11.3125,-3.27734 -12.52344,-3.27734c-1.21094,0 -7.49609,0.15625 -12.52344,3.27734c-0.46875,0.29297 -1.08594,0.14844 -1.375,-0.32031c-0.29297,-0.47266 -0.14844,-1.08594 0.32031,-1.37891c2.92578,-1.8125 6.16016,-2.71094 8.79297,-3.15234c-0.15234,-0.49609 -0.28906,-0.80859 -0.30078,-0.83594c-0.17578,-0.38672 -0.57031,-0.62891 -0.99219,-0.58594c-0.26953,0.01953 -6.56641,0.5625 -10.60156,3.80859c-2.10547,1.94922 -6.32031,13.33984 -6.32031,23.1875c0,0.17578 0.04688,0.34375 0.13281,0.49609c2.90625,5.10938 10.83984,6.44531 12.64844,6.50391c0.00781,0 0.01953,0 0.03125,0c0.32031,0 0.62109,-0.15234 0.80859,-0.41016l1.82813,-2.51562c-4.93359,-1.27344 -7.45312,-3.4375 -7.59766,-3.56641c-0.41406,-0.36328 -0.45312,-0.99609 -0.08594,-1.41016c0.36328,-0.41406 0.99609,-0.45312 1.41016,-0.08984c0.05859,0.05469 4.69922,3.99219 13.82422,3.99219c9.14063,0 13.78125,-3.95312 13.82813,-3.99219c0.41406,-0.35937 1.04297,-0.32422 1.41016,0.09375c0.36328,0.41406 0.32422,1.04297 -0.08984,1.40625c-0.14453,0.12891 -2.66406,2.29297 -7.59766,3.56641l1.82813,2.51563c0.1875,0.25781 0.48828,0.41016 0.80859,0.41016c0.01172,0 0.02344,0 0.03125,0c1.80859,-0.05859 9.74219,-1.39453 12.64844,-6.50391c0.08594,-0.15234 0.13281,-0.32031 0.13281,-0.49609c0,-9.84766 -4.21484,-21.23828 -6.375,-23.23047zM18.5,30c-1.93359,0 -3.5,-1.78906 -3.5,-4c0,-2.21094 1.56641,-4 3.5,-4c1.93359,0 3.5,1.78906 3.5,4c0,2.21094 -1.56641,4 -3.5,4zM31.5,30c-1.93359,0 -3.5,-1.78906 -3.5,-4c0,-2.21094 1.56641,-4 3.5,-4c1.93359,0 3.5,1.78906 3.5,4c0,2.21094 -1.56641,4 -3.5,4z"
          />
        </svg>
      );
    default:
      return null;
  }
}

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
      <nav
        className="site-footer-social web-only"
        aria-label={authorSocialAria[lang]}
      >
        <ul className="site-footer-social-list">
          {AUTHOR_SOCIALS.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                className="site-footer-social-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
              >
                <SocialIcon id={item.id} />
              </a>
            </li>
          ))}
        </ul>
      </nav>
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
