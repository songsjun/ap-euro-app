import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  allowedDevOrigins: ['euro.kapy.ca'],
  images: { unoptimized: true },
}

export default nextConfig
