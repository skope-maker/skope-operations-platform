import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend the dev server proxies /api to (FastAPI, see backend/server.py).
const BACKEND_TARGET = process.env.VITE_DEV_PROXY_TARGET || 'http://localhost:8001';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // `REACT_APP_*` is still exposed so an existing frontend/.env that defines
  // REACT_APP_BACKEND_URL keeps working unchanged. New variables should use VITE_.
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    host: true,
    port: 3000,
    proxy: {
      '/api': { target: BACKEND_TARGET, changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 3000,
    proxy: {
      '/api': { target: BACKEND_TARGET, changeOrigin: true },
    },
  },
  build: {
    // Same output directory CRA used, so existing deploy steps keep working.
    outDir: 'build',
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
