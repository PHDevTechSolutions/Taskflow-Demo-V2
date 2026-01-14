import type { NextConfig } from "next";

const nextConfig = {
  experimental: {
    turbopack: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
} as NextConfig; // <-- type assertion to avoid error

export default nextConfig;
