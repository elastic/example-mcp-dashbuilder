import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { Parser } from '@elastic/esql';
import type { ESQLSource } from '@elastic/esql/types';

const ES_NODE = process.env.ES_NODE || 'http://localhost:9200';
const ES_USERNAME = process.env.ES_USERNAME || 'elastic';
const ES_PASSWORD = process.env.ES_PASSWORD || 'changeme';

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: string) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });
}

/**
 * Vite plugin that adds API endpoints for the preview app:
 * - POST /api/save-layout — persist grid layout changes
 * - POST /api/requery — re-run all ES|QL queries with a new time range
 */
function dashboardApiPlugin() {
  const dashboardPath = path.resolve(__dirname, 'public', 'dashboard.json');

  return {
    name: 'dashboard-api',
    configureServer(server: any) {
      // Save layout changes
      server.middlewares.use('/api/save-layout', async (req: any, res: any) => {
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const body = await readBody(req);
          const gridLayout = JSON.parse(body);
          const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'));
          dashboard.gridLayout = gridLayout;
          dashboard.updatedAt = new Date().toISOString();
          const json = JSON.stringify(dashboard, null, 2);
          // Write to active dashboard.json (for the preview app)
          fs.writeFileSync(dashboardPath, json);
          // Also write to the dashboards folder copy (for the export tool)
          const dashboardsDir = path.resolve(__dirname, 'public', 'dashboards');
          const activeIdPath = path.resolve(dashboardsDir, '.active');
          if (fs.existsSync(activeIdPath)) {
            const activeId = fs.readFileSync(activeIdPath, 'utf-8').trim();
            fs.writeFileSync(path.resolve(dashboardsDir, `${activeId}.json`), json);
          }
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end('Invalid JSON');
        }
      });

      // Re-run all ES|QL queries with a new time range
      server.middlewares.use('/api/requery', async (req: any, res: any) => {
        // Handle CORS preflight from MCP App webview
        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        try {
          const body = await readBody(req);
          const { start, end } = JSON.parse(body);
          const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'));

          const authHeader =
            'Basic ' + Buffer.from(`${ES_USERNAME}:${ES_PASSWORD}`).toString('base64');

          let updated = false;

          // Detect time field per index pattern via field_caps, cached
          const timeFieldCache = new Map<string, string | undefined>();

          for (const chart of dashboard.charts) {
            if (!chart.esqlQuery) continue;

            try {
              // Resolve time field for this chart's index (one field_caps call per unique index)
              const index = parseIndexPattern(chart.esqlQuery);
              let timeField: string | undefined;
              if (index) {
                if (timeFieldCache.has(index)) {
                  timeField = timeFieldCache.get(index);
                } else {
                  timeField = await fetchTimeField(index, authHeader);
                  timeFieldCache.set(index, timeField);
                }
              }

              const filter =
                timeField && start && end
                  ? { range: { [timeField]: { gte: start, lte: end } } }
                  : undefined;

              const esResponse = await fetch(`${ES_NODE}/_query`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: authHeader,
                },
                body: JSON.stringify({ query: chart.esqlQuery, ...(filter && { filter }) }),
              });

              if (!esResponse.ok) continue;

              const result = (await esResponse.json()) as {
                columns: Array<{ name: string; type: string }>;
                values: unknown[][];
              };

              // Convert columnar to rows
              const rows = result.values.map((row: unknown[]) => {
                const obj: Record<string, unknown> = {};
                result.columns.forEach((col: { name: string }, i: number) => {
                  obj[col.name] = row[i];
                });
                return obj;
              });

              chart.data = rows;

              updated = true;
            } catch {
              // Skip failed queries, keep existing data
            }
          }

          if (updated) {
            dashboard.updatedAt = new Date().toISOString();
            const json = JSON.stringify(dashboard, null, 2);
            fs.writeFileSync(dashboardPath, json);
            // Also write to the dashboards folder copy
            const dashboardsDir = path.resolve(__dirname, 'public', 'dashboards');
            const activeIdPath = path.resolve(dashboardsDir, '.active');
            if (fs.existsSync(activeIdPath)) {
              const activeId = fs.readFileSync(activeIdPath, 'utf-8').trim();
              fs.writeFileSync(path.resolve(dashboardsDir, `${activeId}.json`), json);
            }
          }

          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ ok: true, updated }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}

/** Extract the index pattern from an ES|QL query using the @elastic/esql parser. */
function parseIndexPattern(query: string): string | undefined {
  try {
    const { root } = Parser.parse(query);
    const sourceCommand = root.commands.find(
      ({ name }) => name.toUpperCase() === 'FROM' || name.toUpperCase() === 'TS'
    );
    if (!sourceCommand) return undefined;

    const sources = (sourceCommand.args as ESQLSource[])
      .filter((arg) => arg.sourceType === 'index')
      .map((index) => index.name);

    return sources.join(',') || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Use the field capabilities API to find the time field for an index.
 * Priority: @timestamp > timestamp > first date field.
 */
async function fetchTimeField(index: string, authHeader: string): Promise<string | undefined> {
  try {
    const response = await fetch(
      `${ES_NODE}/${encodeURIComponent(index)}/_field_caps?fields=*&types=date,date_nanos`,
      { headers: { Authorization: authHeader } }
    );
    if (!response.ok) return undefined;

    const result = (await response.json()) as { fields: Record<string, unknown> };
    const dateFields = Object.keys(result.fields || {});

    if (dateFields.includes('@timestamp')) return '@timestamp';
    if (dateFields.includes('timestamp')) return 'timestamp';
    return dateFields[0];
  } catch {
    return undefined;
  }
}

export default defineConfig({
  plugins: [
    react({
      jsxImportSource: '@emotion/react',
    }),
    dashboardApiPlugin(),
  ],
  server: {
    port: 5173,
    cors: true,
    watch: {
      include: ['public/dashboard.json'],
    },
  },
});
