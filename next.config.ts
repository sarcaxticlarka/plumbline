import type { NextConfig } from "next";

const config: NextConfig = {
  turbopack: { root: import.meta.dirname },
  reactStrictMode: true,
  poweredByHeader: false,
  // node:sqlite is a Node built-in; keep server-only code out of the client bundle.
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default config;
