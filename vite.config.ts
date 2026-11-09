import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendOrigins = [
    env.VITE_NEON_AUTH_URL,
    env.VITE_NEON_FUNCTION_HELLO_BASE_URL,
  ].filter(Boolean).map((value) => {
    try {
      return new URL(value).origin;
    } catch {
      throw new Error('Neon endpoint URLs must be valid absolute URLs to build the production CSP.');
    }
  });

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'production-content-security-policy',
        apply: 'build',
        transformIndexHtml(html) {
          const csp = [
            "default-src 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "style-src-attr 'unsafe-inline'",
            "font-src 'self' https://fonts.gstatic.com data:",
            `connect-src 'self' ${backendOrigins.join(' ')}`,
            "img-src 'self' data: blob:",
            "manifest-src 'self'",
            "worker-src 'self'",
            "frame-src 'none'",
            "form-action 'self'",
            'upgrade-insecure-requests',
          ].join('; ');
          return html.replace(
            '<head>',
            `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
          );
        },
      },
    ],
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
      manifest: 'vite-manifest.json',
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
