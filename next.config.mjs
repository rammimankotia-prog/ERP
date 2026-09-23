/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent stale chunk errors after deploys by setting proper cache headers
  async headers() {
    return [
      {
        // JS/CSS chunks — immutable, long-lived (content-addressed by hash)
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // HTML pages — always revalidate so browser gets fresh chunk references
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
