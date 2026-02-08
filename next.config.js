/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  // Не бандлить pdfkit: в бандле __dirname = папка route, и PDFKit не находит data/Helvetica.afm
  serverExternalPackages: ['pdfkit'],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  webpack: (config, { isServer, dev }) => {
    // Fix for webpack module resolution issues
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    
    // Ensure proper path resolution for @/* aliases
    const rootPath = path.resolve(__dirname);
    
    // Override alias to ensure @ points to project root
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': rootPath,
    };
    
    // Ensure proper extension resolution
    config.resolve.extensions = [
      ...config.resolve.extensions,
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
    ];
    
    // Disable caching in development to avoid stale module errors
    if (dev) {
      config.cache = false;
      config.optimization = {
        ...config.optimization,
        concatenateModules: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;
