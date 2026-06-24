import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://vlcms-platform.onrender.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;
