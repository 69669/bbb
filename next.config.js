/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "",
  trailingSlash: true,
  compress: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizeCss: true,
  },
  async headers() {
    return [
      {
        source: "/:all*(svg|jpg|jpeg|png|gif|webp|ico)",
        locale: false,
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:all*(js|css)",
        locale: false,
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
