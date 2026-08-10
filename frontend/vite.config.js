import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /* visualizer({
      filename: 'stats.html',
      title: 'Cognify Bundle Analysis',
      gzipSize: true,
      brotliSize: true,
      open: false // Do not automatically open browser on every build
    }) */
  ],
  css: {
    postcss: {} // Prevents picking up parent directory postcss/tailwindcss v3 config
  },
  build: {
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router-dom') || id.includes('react-router') || id.includes('@remix-run')) {
              return 'vendor-router';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('axios')) {
               return 'vendor-axios';
            }
            if (id.includes('framer-motion')) {
               return 'vendor-framer';
            }
            if (id.includes('lucide-react')) {
               return 'vendor-icons';
            }
            // Other vendor code goes to a general vendor chunk
            return 'vendor-libs';
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
