import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Spectrum cloud iMessage uses Node gRPC — keep out of the Edge/webpack bundle.
  serverExternalPackages: [
    'spectrum-ts',
    '@spectrum-ts/core',
    '@spectrum-ts/imessage',
    '@photon-ai/advanced-imessage',
    '@grpc/grpc-js',
    'nice-grpc',
  ],
};

export default nextConfig;
