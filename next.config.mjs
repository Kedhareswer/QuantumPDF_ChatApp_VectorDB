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
  webpack: (config, { isServer }) => {
    // Completely disable Node.js polyfills for client-side
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
        stream: false,
        console: false,
        util: false,
        os: false,
        crypto: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        child_process: false,
        buffer: false,
        process: false,
        vm: false,
        url: false,
        querystring: false,
        events: false,
        string_decoder: false,
        punycode: false,
        assert: false,
        constants: false,
        domain: false,
        timers: false,
        worker_threads: false,
        cluster: false,
        dgram: false,
        dns: false,
        readline: false,
        repl: false,
        tty: false,
        v8: false,
        inspector: false,
        async_hooks: false,
        perf_hooks: false,
        trace_events: false,
        wasi: false,
      }
    }

    // Exclude problematic modules from bundling
    config.externals = config.externals || []
    if (!isServer) {
      config.externals.push({
        'node:fs': 'commonjs node:fs',
        'node:path': 'commonjs node:path',
        'node:stream': 'commonjs node:stream',
        'node:crypto': 'commonjs node:crypto',
        'node:util': 'commonjs node:util',
        'node:os': 'commonjs node:os',
        'node:buffer': 'commonjs node:buffer',
        'node:process': 'commonjs node:process',
        'node:url': 'commonjs node:url',
        'node:events': 'commonjs node:events',
      })
    }

    return config
  },
}

export default nextConfig
