import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Disable error overlay
      config.devServer = {
        ...config.devServer,
        client: {
          overlay: false,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
