import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // i18n Configuration - TypeScript may warn about this, but it's supported
  i18n: {
    locales: ['en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
    defaultLocale: 'en',
    localeDetection: true,
  },
  
  // React Strict Mode
  reactStrictMode: true,
  
  // Image Configuration
  images: {
    domains: ['localhost', 'minio:9000'],
    // Consider adding remotePatterns for better security (Next.js 13+)
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'minio',
        port: '9000',
        pathname: '/**',
      },
    ],
  },
  
  // Transpile Packages (if using any external packages that need transpilation)
  transpilePackages: [],
  
  // Rewrites Configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api-gateway:3000/api/:path*',
      },
      {
        source: '/booking-api/:path*',
        destination: 'http://booking-service:3002/:path*',
      },
      {
        source: '/yoga-api/:path*',
        destination: 'http://yoga-service:3003/:path*',
      },
      {
        source: '/voice-api/:path*',
        destination: 'http://voice-service:8005/:path*',
      },
      {
        source: '/api/i18n/:path*',
        destination: `${process.env.I18N_SERVICE_URL || 'http://localhost:3005'}/i18n/:path*`,
      },
    ];
  },
  
  // Headers Configuration
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Language',
            value: 'en',
          },
        ],
      },
    ];
  },
  
  // Webpack Configuration (if needed)
  webpack: (config, { isServer }) => {
    // Add custom webpack configurations if needed
    return config;
  },
  
  // Server Runtime Configuration
  serverRuntimeConfig: {
    apiUrl: process.env.API_URL || 'http://api-gateway:3000',
    i18nServiceUrl: process.env.I18N_SERVICE_URL || 'http://localhost:3005',
  },
  
  // Public Runtime Configuration
  publicRuntimeConfig: {
    publicApiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    yogaServiceUrl: process.env.NEXT_PUBLIC_YOGA_SERVICE_URL || 'http://localhost:3003',
    bookingServiceUrl: process.env.NEXT_PUBLIC_BOOKING_SERVICE_URL || 'http://localhost:3002',
    voiceServiceUrl: process.env.NEXT_PUBLIC_VOICE_SERVICE_URL || 'http://localhost:8005',
    i18nServiceUrl: process.env.NEXT_PUBLIC_I18N_SERVICE_URL || 'http://localhost:3005',
  },
  
  // Optional: Add experimental features if needed
  experimental: {
    // appDir: true, // If using Next.js 13+ App Router
    // serverActions: true, // If using Server Actions
  },
};

export default nextConfig;