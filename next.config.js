/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
    serverComponentsExternalPackages: ['@huggingface/transformers'],
  },
  // Configuration PWA native Next.js 15
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  distDir: 'out',
  
  // Support WebAssembly pour Transformers.js
  webpack: (config, { isServer }) => {
    // Configuration WebAssembly
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    
    // Support des fichiers .wasm
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });
    
    // Configuration pour les Web Workers
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    
    return config;
  },
  
  // Headers pour Cross-Origin Isolation (requis pour WebGPU)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin'
          }
        ],
      },
    ];
  },
  
  // Configuration des images
  images: {
    unoptimized: true,
  },
  
  // Variables d'environnement publiques
  env: {
    CUSTOM_KEY: 'whisper-pwa',
  },
};

module.exports = nextConfig;