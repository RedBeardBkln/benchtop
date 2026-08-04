import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep heavy server-only packages from being bundled by Next.js
  serverExternalPackages: ['@react-pdf/renderer', 'exceljs'],

  webpack(config, { isServer }) {
    // Enable async WebAssembly for glpk.js (LP solver) — webpack builds only (not Turbopack dev)
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    return config
  },

  turbopack: {
    // Native WASM support — no extra rules needed
  },
}

export default nextConfig
