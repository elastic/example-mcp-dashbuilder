import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { Parser } from '@elastic/esql';
import type { ESQLSource } from '@elastic/esql/types';

// Load .env from project root
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

const ES_CLOUD_ID = process.env.ES_CLOUD_ID;
const ES_NODE = process.env.ES_NODE || 'http://localhost:9200';
const ES_API_KEY = process.env.ES_API_KEY;
const ES_USERNAME = process.env.ES_USERNAME || 'elastic';
const ES_PASSWORD = process.env.ES_PASSWORD || 'changeme';

const AUTH_HEADER = ES_API_KEY
  ? `ApiKey ${ES_API_KEY}`
  : 'Basic ' + Buffer.from(`${ES_USERNAME}:${ES_PASSWORD}`).toString('base64');

// Resolve the ES endpoint — Cloud ID encodes the endpoint
function resolveEsEndpoint(): string {
  if (ES_CLOUD_ID) {
    const decoded = Buffer.from(ES_CLOUD_ID.split(':')[1] || '', 'base64').toString();
    const [host, esId] = decoded.split('$');
    return `https://${esId}.${host}`;
  }
  return ES_NODE;
}

const ES_ENDPOINT = resolveEsEndpoint();

// Cache time field detection per index pattern (persists across requests)
const timeFieldCache = new Map<string, string | undefined>();

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
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
          const { query, start, end, timeField: explicitTimeField } = JSON.parse(body);

          if (!query) {
            res.statusCode = 400;
            setCorsHeaders(res);
            res.end(JSON.stringify({ error: 'Missing query' }));
            return;
          }

          // Build DSL time filter. Use explicit timeField if provided,
          // otherwise detect via field_caps (only @timestamp/timestamp are safe defaults).
          let filter: Record<string, unknown> | undefined;
          if (start && end) {
            let resolvedTimeField = explicitTimeField;
            if (!resolvedTimeField) {
              const index = parseIndexPattern(query);
              if (index) {
                if (!timeFieldCache.has(index)) {
                  timeFieldCache.set(index, await fetchTimeField(index));
                }
                const detected = timeFieldCache.get(index);
                // Only auto-apply for well-known time fields to avoid wrong filtering
                if (detected === '@timestamp' || detected === 'timestamp') {
                  resolvedTimeField = detected;
                }
              }
            }
            if (resolvedTimeField) {
              filter = { range: { [resolvedTimeField]: { gte: start, lte: end } } };
            }
          }

          const esResponse = await fetch(`${ES_ENDPOINT}/_query`, {
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
      `${ES_ENDPOINT}/${encodeURIComponent(index)}/_field_caps?fields=*&types=date,date_nanos`,
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
  },
});
