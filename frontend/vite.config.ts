import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Cho phép mọi host khi truy cập qua tunnel HTTPS (trycloudflare.com / tên miền khác)
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/logo': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/manifest.webmanifest': { target: 'http://127.0.0.1:4000', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist'
  }
});