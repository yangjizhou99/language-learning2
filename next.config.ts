import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  trailingSlash: false,
  
  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30天
  },
  
  // 支持多域名CORS + 缓存头优化
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*', // 允许所有域名访问
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
      // 静态资源缓存 - 移除固定缓存头，让代理路由自己设置
      // {
      //   source: '/api/storage-proxy/:path*',
      //   headers: [
      //     {
      //       key: 'Cache-Control',
      //       value: 'public, s-maxage=604800, max-age=86400, immutable',
      //     },
      //   ],
      // },
      // 音频文件缓存
      {
        source: '/api/tts',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, max-age=3600',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
