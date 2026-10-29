import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    // Change to '/' if you move the frontend to Vercel (see PHASE1_NOTES.md).
    base: process.env.VITE_BASE_PATH ?? '/kam-fleets/',
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: (moduleId) => {
            if (
              moduleId.includes('/node_modules/react/') ||
              moduleId.includes('/node_modules/react-dom/')
            ) {
              return 'vendor-react';
            }
            if (
              moduleId.includes('/node_modules/@neondatabase/auth/') ||
              moduleId.includes('/node_modules/@neon/config/') ||
              moduleId.includes('/node_modules/@neon/functions/')
            ) {
              return 'vendor-neon';
            }
            if (moduleId.includes('/node_modules/lucide-react/')) {
              return 'vendor-ui';
            }
          },
        },
      },
    },
  };
});
