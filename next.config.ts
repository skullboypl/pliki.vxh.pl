import type { NextConfig } from 'next';
import packageJson from './package.json';

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  transpilePackages: ['@videojs/react', '@videojs/core', '@videojs/utils', '@videojs/spf', '@videojs/store'],
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  async headers() {
    const staticCache = isProd
      ? [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
      : [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ];

    return [
      {
        source: '/_next/static/:path*',
        headers: staticCache,
      },
      {
        source: '/((?!_next/static|_next/image).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
