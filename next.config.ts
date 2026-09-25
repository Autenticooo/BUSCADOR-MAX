import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // o preview do sandbox é servido por um host *.e2b.app
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
};

export default nextConfig;
