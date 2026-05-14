/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['react-markdown'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
    ],
  },
};
export default nextConfig;