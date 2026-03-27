import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { Parser } from '@elastic/esql';
import type { ESQLSource } from '@elastic/esql/types';

const ES_NODE = process.env.ES_NODE || 'http://localhost:9200';
const ES_USERNAME = process.env.ES_USERNAME || 'elastic';
const ES_PASSWORD = process.env.ES_PASSWORD || 'changeme';
const AUTH_HEADER = 'Basic ' + Buffer.from(`${ES_USERNAME}:${ES_PASSWORD}`).toString('base64');

// Cache time field detection per index pattern (persists across requests)
const timeFieldCache = new Map<string, string | undefined>();

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: string) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
  });
}

/** Handle CORS preflight + reject non-POST. Returns true if the request was handled. */
function handleCorsAndMethod(req: any, res: any): boolean {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return true;
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method not allowed');
    return true;
  }
  return false;
}

function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Vite plugin that adds API endpoints for the preview app:
 * - POST /api/save-layout — persist grid layout changes
 * - POST /api/esql — proxy ES|QL queries to Elasticsearch with optional time filter
 */
function dashboardApiPlugin() {
  const dashboardPath = path.resolve(__dirname, 'public', 'dashboard.json');

  return {
    name: 'dashboard-api',
    configureServer(server: any) {
      // Save layout changes
      server.middlewares.use('/api/save-layout', async (req: any, res: any) => {
        if (handleCorsAndMethod(req, res)) return;

        try {
          const body = await readBody(req);
          const gridLayout = JSON.parse(body);
          const dashboard = JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'));
          dashboard.gridLayout = gridLayout;
          dashboard.updatedAt = new Date().toISOString();
          const json = JSON.stringify(dashboard, null, 2);
          fs.writeFileSync(dashboardPath, json);
          // Also write to the dashboards folder copy (for the export tool)
          const dashboardsDir = path.resolve(__dirname, 'public', 'dashboards');
          const activeIdPath = path.resolve(dashboardsDir, '.active');
          if (fs.existsSync(activeIdPath)) {
            const activeId = fs.readFileSync(activeIdPath, 'utf-8').trim();
            fs.writeFileSync(path.resolve(dashboardsDir, `${activeId}.json`), json);
          }
          res.setHeader('Content-Type', 'application/json');
          setCorsHeaders(res);
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end('Invalid JSON');
        }
      });

      // Proxy a single ES|QL query to Elasticsearch, with optional time filter
      server.middlewares.use('/api/esql', async (req: any, res: any) => {
        if (handleCorsAndMethod(req, res)) return;

        try {
          const body = await readBody(req);
          const { query, start, end } = JSON.parse(body);

          if (!query) {
            res.statusCode = 400;
            setCorsHeaders(res);
            res.end(JSON.stringify({ error: 'Missing query' }));
            return;
          }

          // Detect time field and build DSL filter
          let filter: Record<string, unknown> | undefined;
          if (start && end) {
            const index = parseIndexPattern(query);
            if (index) {
              if (!timeFieldCache.has(index)) {
                timeFieldCache.set(index, await fetchTimeField(index));
              }
              const timeField = timeFieldCache.get(index);
              if (timeField) {
                filter = { range: { [timeField]: { gte: start, lte: end } } };
              }
            }
          }

          const esResponse = await fetch(`${ES_NODE}/_query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: AUTH_HEADER },
            body: JSON.stringify({ query, ...(filter && { filter }) }),
          });

          if (!esResponse.ok) {
            const errText = await esResponse.text();
            res.statusCode = 502;
            setCorsHeaders(res);
            res.end(JSON.stringify({ error: errText }));
            return;
          }

          const result = (await esResponse.json()) as {
            columns: Array<{ name: string; type: string }>;
            values: unknown[][];
          };

          const rows = result.values.map((row: unknown[]) => {
            const obj: Record<string, unknown> = {};
            result.columns.forEach((col: { name: string }, i: number) => {
              obj[col.name] = row[i];
            });
            return obj;
          });

          res.setHeader('Content-Type', 'application/json');
          setCorsHeaders(res);
          res.end(JSON.stringify({ rows, columns: result.columns }));
        } catch (err) {
          res.statusCode = 500;
          setCorsHeaders(res);
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
async function fetchTimeField(index: string): Promise<string | undefined> {
  try {
    const response = await fetch(
      `${ES_NODE}/${encodeURIComponent(index)}/_field_caps?fields=*&types=date,date_nanos`,
      { headers: { Authorization: AUTH_HEADER } }
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
