import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Keep heavy server-only packages from being bundled by Next.js
  serverExternalPackages: ['@react-pdf/renderer', 'exceljs'],

  // Turbopack-specific options.
  // The previous webpack `asyncWebAssembly` experiment is no longer needed:
  // glpk.js loads its own .wasm at runtime, and no .wasm files are imported
  // directly in app code. Turbopack handles wasm natively when needed.
  turbopack: {},
}

export default nextConfig
