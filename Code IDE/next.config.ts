/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // This ignores TypeScript errors during the build.
    ignoreBuildErrors: true,
  },
  // ... any other config you might have
};

export default nextConfig;
