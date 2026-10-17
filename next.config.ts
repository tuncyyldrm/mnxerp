import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.61',
    '192.168.1.61:3000',
    '192.168.1.109',
    '192.168.1.109:3000',
    'localhost',
    'localhost:3000',
    '127.0.0.1',
    '127.0.0.1:3000',
  ],
};

export default nextConfig;
