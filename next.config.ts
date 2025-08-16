import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false }, // 你现在没有 TS 报错，可以保持严格
};

export default nextConfig;
