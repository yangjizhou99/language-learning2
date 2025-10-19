import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  trailingSlash: false,

  // Image optimization defaults
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Keep native modules external so Webpack does not parse the .node binary
  serverExternalPackages: [
    'pinyin',
    '@node-rs/jieba',
    '@node-rs/jieba-win32-x64-msvc',
  ],

  // Shared API headers, mainly for CORS and caching
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
      {
        source: '/api/tts',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=86400, max-age=3600' },
        ],
      },
    ];
  },

  webpack(config, { isServer }) {
    if (isServer) {
      const externalizeNodeRsJieba = (
        { request }: { request?: string },
        callback: (error?: Error | null, result?: string) => void,
      ) => {
        if (request && /@node-rs\/jieba/.test(request)) {
          return callback(null, `commonjs ${request}`);
        }
        return callback();
      };

      if (Array.isArray(config.externals)) {
        config.externals.push(externalizeNodeRsJieba);
      } else if (config.externals) {
        config.externals = [config.externals, externalizeNodeRsJieba];
      } else {
        config.externals = [externalizeNodeRsJieba];
      }
    }

    return config;
  },
};

export default nextConfig;
