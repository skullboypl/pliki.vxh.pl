import { notFound } from 'next/navigation';
import SeoShell from '@/components/seo/SeoShell';
import { isSeoLang, type SeoLang } from '@/lib/seo/site';

type Props = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

export default async function LangLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isSeoLang(lang)) notFound();

  return <SeoShell lang={lang as SeoLang}>{children}</SeoShell>;
}
