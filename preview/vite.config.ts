import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for building the MCP App preview.
 * This is now purely a build tool — no runtime middleware.
 */
export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
    }),
  ],
});
