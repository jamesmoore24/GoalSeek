/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only use static export for Capacitor builds (npm run build:ios)
  // During development, we need API routes to work
  ...(process.env.CAPACITOR_BUILD === 'true' ? { output: 'export' } : {}),
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig