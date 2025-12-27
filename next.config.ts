import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // eslint config moved to eslint.config.js in Next.js 16+
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

  // 使用 Turbopack 时，通过 serverExternalPackages 处理外部包
  // 这替代了之前的 webpack 配置
  // turbopack: {
  //   rules: {
  //     '*.node': {
  //       loaders: ['file-loader'],
  //       as: '*.js',
  //     },
  //   },
  // },
};

export default nextConfig;
