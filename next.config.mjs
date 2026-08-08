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
  serverExternalPackages: ['@llamaindex/liteparse', 'onnxruntime-node', '@huggingface/transformers', 'sharp'],
  // Trace liteparse's platform-specific native binary (.node) into the
  // serverless function so the addon is present at runtime (e.g. on Vercel).
  // Without this liteparse silently falls back to unpdf.
  //
  // Skipped on Windows: under pnpm, `node_modules/@llamaindex/*` are junctions
  // into the `.pnpm` store, and Turbopack's file tracer panics reading one
  // ("Access is denied. (os error 5)"), which fails the whole build. Tracing is
  // only needed to bundle the addon for a serverless deploy — a local
  // `next build && next start` resolves it from node_modules directly — so
  // dropping it on win32 costs nothing and unblocks pnpm on Windows.
  ...(process.platform === 'win32'
    ? {}
    : { outputFileTracingIncludes: { '/api/pdf/extract': ['./node_modules/@llamaindex/**'] } }),
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
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-Requested-With, Accept, Content-Type, Authorization' },
        ],
      },
    ];
  },
};

export default nextConfig;
