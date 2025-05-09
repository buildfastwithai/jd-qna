/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatar.vercel.sh",
      },

      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn1.iconfinder.com",
      },
      {
        protocol: "https",
        hostname: "zepanalytics.blr1.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "skynetplacements.blr1.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "skynetplacements.blr1.cdn.digitaloceanspaces.com",
      },
    ],
  },
  // Transpile react-pdf and related packages
  transpilePackages: [
    "react-pdf",
    "@react-pdf/renderer",
    "@react-pdf/font",
    "@react-pdf/layout",
    "@react-pdf/pdfkit",
    "@react-pdf/image",
    "@react-pdf/textkit",
    "@react-pdf/types",
    "pdfkit",
  ],
  // Allow importing of PDF fonts in Next.js
  webpack: (config: any) => {
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
};

export default nextConfig;
