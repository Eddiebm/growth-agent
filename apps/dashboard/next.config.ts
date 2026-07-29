import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(__dirname, "../.."),
  experimental: {
    externalDir: true,
  },
  transpilePackages: [],
  webpack: (webpackConfig) => {
    webpackConfig.resolve = webpackConfig.resolve ?? {};
    webpackConfig.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return webpackConfig;
  },
};

export default nextConfig;
