import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  css: {
    postcss: {} // Prevents picking up parent directory postcss/tailwindcss v3 config
  },
  server: {
    port: 5173,
    open: true
  }
})
