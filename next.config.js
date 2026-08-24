/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "",
  trailingSlash: true,
  compress: true,
  poweredByHeader: false,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  optimizeFonts: true,
  images: {
    unoptimized: true,
    formats: ["image/webp"],
  },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|webp|ico)",
        locale: false,
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:all*(js|css)",
        locale: false,
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
