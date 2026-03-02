import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Optimizaciones de build
    rollupOptions: {
      output: {
        // Separar vendors en chunks para mejor caching
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor':     ['react-hot-toast', 'recharts'],
          'utils-vendor':  ['axios', 'date-fns'],
          'export-xlsx':   ['xlsx', 'xlsx-js-style'],
          'export-pdf':    ['jspdf', 'jspdf-autotable'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // Minificación con esbuild (más rápido que terser y viene incluido)
    minify: 'esbuild',
    // Eliminar console.log en producción
    esbuild: {
      drop: ['console', 'debugger'],
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
});

