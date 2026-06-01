/** SkullBoyPL — same links as hero on https://skullboy.pl/ */

export type AuthorSocial = {
  id: string;
  href: string;
  label: string;
};

export const AUTHOR_SOCIALS: readonly AuthorSocial[] = [
  { id: 'youtube', href: 'https://www.youtube.com/@skullboypl', label: 'YouTube' },
  { id: 'tiktok', href: 'https://www.tiktok.com/@skullboypl', label: 'TikTok' },
  { id: 'twitch', href: 'https://twitch.tv/skullboypl', label: 'Twitch' },
  { id: 'instagram', href: 'https://www.instagram.com/skullboy_pl', label: 'Instagram' },
  { id: 'discord', href: 'https://discord.skullmedia.pl/', label: 'Discord' },
] as const;

export const authorSocialAria = {
  pl: 'SkullBoyPL w mediach społecznościowych',
  en: 'SkullBoyPL on social media',
} as const;
