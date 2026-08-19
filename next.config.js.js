/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/bbb",
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
