import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

/**
 * Vite plugin that adds a POST /api/save-layout endpoint.
 * Merges grid positions from the preview app back into dashboard.json.
 */
function layoutSavePlugin() {
  const dashboardPath = path.resolve(__dirname, 'public', 'dashboard.json');

  return {
    name: 'layout-save',
    configureServer(server: any) {
      server.middlewares.use('/api/save-layout', (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', (chunk: string) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const gridLayout = JSON.parse(body);

            // Read current dashboard.json and merge grid positions
            const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'));
            dashboard.gridLayout = gridLayout;
            dashboard.updatedAt = new Date().toISOString();
            fs.writeFileSync(dashboardPath, JSON.stringify(dashboard, null, 2));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 400;
            res.end('Invalid JSON');
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
    }),
    layoutSavePlugin(),
  ],
  server: {
    port: 5173,
    cors: true,
    watch: {
      include: ['public/dashboard.json'],
    },
  },
});
