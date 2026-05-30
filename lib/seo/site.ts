export type SeoLang = 'pl' | 'en';

export const SEO_LANGS: SeoLang[] = ['pl', 'en'];

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://pliki.vxh.pl';

export const SITE_NAME = 'pliki.vxh.pl';

export const GITHUB_REPO_URL = 'https://github.com/skullboypl/pliki.vxh.pl';

export function isSeoLang(value: string): value is SeoLang {
  return value === 'pl' || value === 'en';
}

export function pageUrl(lang: SeoLang, slug: string) {
  return `${SITE_URL}/${lang}/${slug}`;
}

export function hubUrl(lang: SeoLang) {
  return `${SITE_URL}/${lang}`;
}
