import type { MetadataRoute } from 'next';
import packageJson from '../package.json';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'pliki.vxh.pl — wyślij plik w WiFi',
    short_name: 'pliki.vxh.pl',
    description:
      'Przesyłaj pliki w sieci lokalnej (LAN/WiFi) bez instalacji aplikacji. Transfer P2P przez WebRTC — telefon, komputer, tablet.',
    theme_color: '#0a0a0a',
    background_color: '#0a0a0a',
    display: 'standalone',
    orientation: 'any',
    lang: 'pl',
    dir: 'ltr',
    categories: ['utilities', 'productivity'],
    start_url: `/?v=${packageJson.version}`,
    scope: '/',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
