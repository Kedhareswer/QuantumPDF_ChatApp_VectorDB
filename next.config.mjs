/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Fix: Move serverComponentsExternalPackages to root level as serverExternalPackages
  serverExternalPackages: ['onnxruntime-node', 'chromadb', '@huggingface/transformers'],
  // Combine all experimental features into one property
  experimental: {
    // Fix: Remove serverComponentsExternalPackages from experimental
    // Fix: Remove serverActions boolean - it's enabled by default in Next.js 15
  },
  // Configure page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  // Configure webpack
  webpack: (config, { isServer, dev }) => {
    // Fixes npm packages that depend on `node:` protocol
    config.resolve.fallback = {
      ...config.resolve.fallback,
      // Disable Node.js specific modules in the browser
      ...(!isServer && {
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        worker_threads: false,
      }),
    };

    // Exclude problematic modules from client-side bundle
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Replace server-only modules with empty mocks
        'onnxruntime-node': './src/utils/empty-module.js',
        'chromadb': './src/utils/empty-module.js',
        '@huggingface/transformers': './src/utils/empty-module.js',
        '@chroma-core/default-embed': './src/utils/empty-module.js',
        // Don't alias PDF.js, but ensure it's properly loaded
        // 'pdfjs-dist': 'pdfjs-dist/legacy/build/pdf',
      };

      // Add more externals if needed
      config.externals = [...(config.externals || []), {
        'onnxruntime-node': 'commonjs onnxruntime-node',
        'chromadb': 'commonjs chromadb',
        '@huggingface/transformers': 'commonjs @huggingface/transformers',
        '@chroma-core/default-embed': 'commonjs @chroma-core/default-embed',
      }];
    }

    // Configure PDF.js worker
    config.module.rules.push({
      test: /\.worker\.(js|ts|tsx)$/,
      use: [
        {
          loader: 'worker-loader',
          options: {
            publicPath: '/_next/',
          },
        },
      ],
    });

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
