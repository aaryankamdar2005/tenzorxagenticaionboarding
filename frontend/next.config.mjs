/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // face-api.js (via TensorFlow.js) tries to import Node's `fs` module.
  // In the browser bundle this doesn't exist — alias it to false so webpack
  // produces an empty stub instead of crashing.
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        "node-fetch": false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
};

export default nextConfig;
