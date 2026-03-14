const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
};

module.exports = nextConfig;
