import type { NextConfig } from 'next';

import { readWebEnvironment } from './src/config/environment';

const { API_INTERNAL_ORIGIN } = readWebEnvironment();

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
