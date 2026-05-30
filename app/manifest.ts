import type { MetadataRoute } from 'next';
import packageJson from '../package.json';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Udostępnianie P2P LAN',
    short_name: 'pliki.vxh.pl',
    description: 'Aplikacja do transferu plików P2P przez WebRTC w sieci lokalnej',
    theme_color: '#131313',
    background_color: '#131313',
    display: 'standalone',
    start_url: `/?v=${packageJson.version}`,
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
