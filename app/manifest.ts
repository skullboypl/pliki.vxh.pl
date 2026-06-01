import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'pliki.vxh.pl: wyślij plik w WiFi',
    short_name: 'pliki.vxh.pl',
    description:
      'Przesyłaj pliki w sieci lokalnej (LAN/WiFi) bez instalacji aplikacji. Transfer P2P przez WebRTC: telefon, komputer, tablet.',
    theme_color: '#0a0a0a',
    background_color: '#0a0a0a',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    orientation: 'any',
    lang: 'pl',
    dir: 'ltr',
    categories: ['utilities', 'productivity'],
    start_url: '/',
    scope: '/',
    id: '/',
    icons: [
      {
        src: '/icon-192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-wide',
        sizes: '1280x720',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Widok aplikacji PWA: urządzenia w sieci WiFi',
      },
      {
        src: '/screenshot-narrow',
        sizes: '540x720',
        type: 'image/png',
        label: 'Aplikacja PWA: wysyłanie plików z telefonu',
      },
    ],
  };
}
