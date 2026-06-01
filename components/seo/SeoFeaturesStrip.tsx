import SeoTopicIcon from '@/components/seo/SeoTopicIcon';
import { getHubFeatures } from '@/lib/seo/pages';
import type { SeoLang } from '@/lib/seo/site';

type Props = {
  lang: SeoLang;
};

export default function SeoFeaturesStrip({ lang }: Props) {
  const features = getHubFeatures(lang);

  return (
    <section className="seo-features" aria-label={lang === 'pl' ? 'Funkcje aplikacji' : 'App features'}>
      <h2 className="seo-features__heading">{features.heading}</h2>
      <ul className="seo-features__list">
        {features.items.map((item) => (
          <li key={item.icon} className="seo-features__item">
            <span className="seo-features__icon" aria-hidden>
              <SeoTopicIcon id={item.icon} size={20} />
            </span>
            <span className="seo-features__text">
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
