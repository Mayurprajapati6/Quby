import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // framer-motion v12 exports 'motion/react' subpath — alias it so TS/Vite resolve correctly
      'motion/react': 'framer-motion',
    },
  },
  build: {
    // ✅ FIX: Prevent chunk loading errors on Vercel
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    host: '0.0.0.0',   // ← allows access from mobile/other devices on same WiFi
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
