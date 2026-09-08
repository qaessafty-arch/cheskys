import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  // Support GitHub Pages subdirectory and custom domain deployments seamlessly
  base: mode === 'production' ? (process.env.PUBLIC_BASE_PATH || './') : '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/database', 'firebase/storage'],
          motion: ['motion/react'],
          chess: ['chess.js'],
          icons: ['lucide-react'],
          i18n: ['i18next', 'react-i18next'],
        }
      }
    },
    chunkSizeWarningLimit: 900
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'motion/react',
      'lucide-react',
      'firebase/app',
      'firebase/auth',
      'firebase/firestore',
      'firebase/storage',
      'date-fns',
      'canvas-confetti'
    ],
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true as const,
    // Let Vite derive the HMR endpoint from the active preview server. A hard-coded
    // localhost:5173 endpoint makes the browser connect to a socket that does not exist
    // when the sandbox exposes the app on another port or through a preview proxy.
    hmr: false,
    // Disable file watching entirely in production / agent mode to save CPU.
    watch: mode === 'production' ? null : {
      usePolling: true,
      interval: 1000,
    },
  },
  // Ensure WebSocket errors are suppressed by defining the environment
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode)
  }
}));
