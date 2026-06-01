import Link from 'next/link';
import SeoTopicIcon from '@/components/seo/SeoTopicIcon';
import { getSlug, type SeoPage } from '@/lib/seo/pages';
import type { SeoLang } from '@/lib/seo/site';

type Props = {
  page: SeoPage;
  lang: SeoLang;
};

export default function SeoTopicCard({ page, lang }: Props) {
  return (
    <Link href={`/${lang}/${getSlug(page, lang)}`} className="seo-topic-card">
      <span className="seo-topic-card__icon" aria-hidden>
        <SeoTopicIcon id={page.icon} size={24} />
      </span>
      <span className="seo-topic-card__body">
        <strong>{page.h1[lang]}</strong>
        <span>{page.description[lang]}</span>
      </span>
    </Link>
  );
}
