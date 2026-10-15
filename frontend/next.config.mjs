/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {};

nextConfig.output = "export";
nextConfig.trailingSlash = true;
nextConfig.images = { unoptimized: true };
nextConfig.basePath = basePath;
nextConfig.assetPrefix = basePath ? `${basePath}/` : undefined;

export default nextConfig;
