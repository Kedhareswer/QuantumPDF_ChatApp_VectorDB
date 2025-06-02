/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Handle PDF.js worker and Node.js modules
    if (!isServer) {
      // Prevent Node.js modules from being bundled
      config.resolve.fallback = {
        fs: false,
        path: false,
        stream: false,
        crypto: false,
        console: false,
        'node:fs': false,
        'node:path': false,
        'node:stream': false,
        'node:crypto': false,
        'node:console': false,
      }
    }

    return config
  },
  experimental: {
    esmExternals: 'loose',
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
