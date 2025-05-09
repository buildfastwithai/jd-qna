import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Allow importing of PDF fonts in Next.js
  webpack: (config, { isServer }) => {
    // Handle log4js module issues
    if (isServer) {
      // Mark problematic modules as external to prevent bundling
      const externalPackages = ["log4js", "@adobe/pdfservices-node-sdk"];
      config.externals = [...(config.externals || []), ...externalPackages];
    }

    // Special handling for dynamic imports
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];

    // Add a rule to handle dynamic imports
    config.module.rules.push({
      test: /\.cjs$/,
      use: "null-loader",
    });

    // Add loader for .node files
    config.module.rules.push({
      test: /\.node$/,
      use: "node-loader",
    });

    // Disable node: prefix in imports
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
      fs: false,
    };

    return config;
  },
  // Increase the serverComponentsExternalPackages array to exclude certain packages
  // from the server-side bundle
  // experimental: {
  //   serverComponentsExternalPackages: [
  //     "log4js",
  //     "@adobe/pdfservices-node-sdk",
  //     "unzipper",
  //   ],
  // },
};

export default nextConfig;
