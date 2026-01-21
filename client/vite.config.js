import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - generates stats.html on build
    visualizer({
      filename: 'bundle-stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  // Build optimizations
  build: {
    // Split chunks for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-excel': ['exceljs'],
          'vendor-ui': ['lucide-react']
        }
      }
    },
    // Enable source maps for production debugging
    sourcemap: true,
    // Chunk size warning limit (1000kb = 1MB)
    // Increased to accommodate lazy-loaded libraries:
    // - ExcelJS: ~938 KB (only loads on Excel export)
    // - jsPDF: ~417 KB (only loads on PDF export)
    chunkSizeWarningLimit: 1000
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js']
  },
  test: {
    // Enable Vitest globals (describe, it, expect, etc.)
    globals: true,
    // Use jsdom for DOM simulation
    environment: 'jsdom',
    // Setup file for test configuration
    setupFiles: ['./src/test/setup.js'],
    // Include test files (only unit tests in src/, not integration tests)
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    // Exclude node_modules and integration tests
    exclude: ['node_modules', 'dist', '../tests/**'],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.{js,jsx,ts,tsx}'
      ]
    },
    // CSS handling
    css: true,
    // Reporter
    reporters: ['default', 'html'],
    // Output directory for reports
    outputFile: {
      html: './coverage/test-report.html'
    }
  }
})
