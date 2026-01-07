/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
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
        source: '/voice-api/:path*',
        destination: 'http://voice-service:8005/:path*',
      },
    ];
  },
  // Allow CORS for development
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  // Configure external API calls in production
  serverRuntimeConfig: {
    // Will only be available on the server side
    apiUrl: process.env.API_URL || 'http://api-gateway:3000',
  },
  publicRuntimeConfig: {
    // Will be available on both server and client
    publicApiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
    bookingServiceUrl: process.env.NEXT_PUBLIC_BOOKING_SERVICE_URL || 'http://localhost:3002',
    voiceServiceUrl: process.env.NEXT_PUBLIC_VOICE_SERVICE_URL || 'http://localhost:8005',
  },
};

module.exports = nextConfig;