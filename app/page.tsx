import ShareAppClient from '@/components/ShareAppClient';
import { jsonLdHome } from '@/lib/seo/appMeta';

export default function Home() {
  const jsonLd = jsonLdHome();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ShareAppClient />
    </>
  );
}
