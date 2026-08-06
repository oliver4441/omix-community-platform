import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",

  // Pinata IPFS gateway + Firebase Storage images
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.firebasestorage.app",
      },
    ],
  },

  // Ensure static export uses dist/
  distDir: "dist",

  // Experimental features for PWA
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "firebase/auth",
      "firebase/firestore",
      "firebase/storage",
    ],
  },
};

export default nextConfig;
