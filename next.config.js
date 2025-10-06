/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration PWA native Next.js 15
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  distDir: 'out',
  
  // Support WebAssembly pour Transformers.js
  webpack: (config, { isServer }) => {
    // Configuration WebAssembly plus simple
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };
    
    // Configuration pour les Web Workers
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
      };
      
      // Ignore node-specific modules
      config.externals = config.externals || [];
      config.externals.push({
        'sharp': 'sharp',
        'onnxruntime-node': 'onnxruntime-node',
      });
    }
    
    return config;
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