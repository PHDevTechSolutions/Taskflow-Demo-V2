import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        tls: false,
        net: false,
        fs: false,
        dns: false,
        child_process: false,
      };
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      child_process: './node_modules/next/dist/esm/lib/empty.js',
      dns: './node_modules/next/dist/esm/lib/empty.js',
      fs: './node_modules/next/dist/esm/lib/empty.js',
      net: './node_modules/next/dist/esm/lib/empty.js',
      tls: './node_modules/next/dist/esm/lib/empty.js',
    },
  },
  experimental: {
    serverComponentsExternalPackages: ['mongodb', 'mongoose', '@grpc/grpc-js'],
  },
};

export default nextConfig;
