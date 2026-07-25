import type { NextConfig } from "next"

const API_INTERNAL_URL = (process.env.API_INTERNAL_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
)

const nextConfig: NextConfig = {
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api-docs",
        destination: `${API_INTERNAL_URL}/api-docs/`,
      },
      {
        source: "/api-docs/:path*",
        destination: `${API_INTERNAL_URL}/api-docs/:path*`,
      },
      {
        source: "/swagger-ui.css",
        destination: `${API_INTERNAL_URL}/api-docs/swagger-ui.css`,
      },
      {
        source: "/swagger-ui-bundle.js",
        destination: `${API_INTERNAL_URL}/api-docs/swagger-ui-bundle.js`,
      },
      {
        source: "/swagger-ui-standalone-preset.js",
        destination: `${API_INTERNAL_URL}/api-docs/swagger-ui-standalone-preset.js`,
      },
      {
        source: "/swagger-ui-init.js",
        destination: `${API_INTERNAL_URL}/api-docs/swagger-ui-init.js`,
      },
      {
        source: "/favicon-16x16.png",
        destination: `${API_INTERNAL_URL}/api-docs/favicon-16x16.png`,
      },
      {
        source: "/favicon-32x32.png",
        destination: `${API_INTERNAL_URL}/api-docs/favicon-32x32.png`,
      },
      {
        source: "/api/:path*",
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
