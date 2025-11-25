/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // External packages that should not be bundled
  serverExternalPackages: ['onnxruntime-node', '@huggingface/transformers', 'sharp'],
  // Turbopack config (Next.js 16 default)
  turbopack: {},
  experimental: {
    // Enable experimental features if needed
  },
  // Configure page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Simplified webpack config - only essential polyfills
  webpack: (config, { isServer }) => {
    // Only add Node.js polyfills for client-side
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        worker_threads: false,
      };
    }

    return config;
  },
  // Configure CORS for development
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Accept, Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
