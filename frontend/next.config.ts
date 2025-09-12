import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence workspace root warning by setting the tracing root to this app
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
