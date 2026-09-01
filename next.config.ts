import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
    ],
    // Every post/avatar/listing image is user-uploaded and served from Firebase Storage's own
    // CDN. Routing each one through Next's server-side image optimizer (fetch → resize →
    // re-encode, on every unique image) was timing out under real load — confirmed via
    // repeated `/_next/image` 500s with "TimeoutError: operation was aborted due to timeout" —
    // which is what was actually behind the reports of Central/Leaderboard failing to load,
    // not a data or rendering bug. Serving images directly from Firebase's CDN instead (skipping
    // Next's resize step) trades a bit of extra bandwidth for images that reliably load at all.
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
