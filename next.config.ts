import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {},
  serverExternalPackages: ["pdfjs-dist", "@napi-rs/canvas"],
  webpack: (config) => {
    // Suppress pdfjs-dist canvas binary warnings/errors in server environments
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
