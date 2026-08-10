import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  // Static export uses dist/
  distDir: "dist",

  // Experimental features for PWA
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
