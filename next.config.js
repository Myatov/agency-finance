/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization to avoid module resolution issues
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
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
    
    // Disable caching in development to avoid stale module errors
    if (dev) {
      config.cache = false;
      // Disable module concatenation to avoid module resolution issues
      config.optimization = {
        ...config.optimization,
        concatenateModules: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;
