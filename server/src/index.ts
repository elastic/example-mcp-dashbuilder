import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env file if it exists (before any other imports that read env vars)
const __root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const envPath = resolve(__root, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerRunEsql } from './tools/run-esql.js';
import { registerListIndices } from './tools/list-indices.js';
import { registerCreateChart } from './tools/create-chart.js';
import { registerCreateMetric } from './tools/create-metric.js';
import { registerCreateHeatmap } from './tools/create-heatmap.js';
import { registerSectionTools } from './tools/create-section.js';
import { registerManageDashboard } from './tools/manage-dashboard.js';
import { registerExportToKibana } from './tools/export-to-kibana.js';
import { registerImportFromKibana } from './tools/import-from-kibana.js';
import { registerViewDashboard } from './tools/view-dashboard.js';
import { closeBrowser } from './utils/chart-renderer.js';
import { DATAVIZ_GUIDELINES } from './resources/dataviz-guidelines.js';
import { buildEsqlReference } from './resources/esql-reference.js';

// Start the Vite preview server as a background child process.
// The MCP app and Puppeteer renderer need it for API endpoints and dashboard.json.
const __dirname = dirname(fileURLToPath(import.meta.url));
const previewDir = resolve(__dirname, '..', '..', 'preview');
let viteProcess: ChildProcess | undefined;

function startViteServer() {
  viteProcess = spawn('npx', ['vite', '--port', '5173'], {
    cwd: previewDir,
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: false,
  });
  viteProcess.on('error', () => {}); // swallow — non-critical
}

const server = new McpServer({
  name: 'elastic-dashbuilder',
  version: '0.1.0',
});

// Register dataviz best practices as a resource
server.resource(
  'dataviz-guidelines',
  'dataviz://guidelines',
  {
    description:
      'Data visualization best practices for choosing chart types, composing dashboards, ' +
      'writing ES|QL queries for visualizations, and avoiding common anti-patterns. ' +
      'Read this before creating charts or dashboards.',
    mimeType: 'text/markdown',
  },
  async () => ({
    contents: [
      {
        uri: 'dataviz://guidelines',
        mimeType: 'text/markdown',
        text: DATAVIZ_GUIDELINES,
      },
    ],
  })
);

// Register ES|QL reference as a resource
server.resource(
  'esql-reference',
  'esql://reference',
  {
    description:
      'ES|QL language reference — commands, functions, operators, and common query patterns ' +
      'for dashboard visualizations. Read this when writing ES|QL queries to ensure correct syntax.',
    mimeType: 'text/markdown',
  },
  async () => ({
    contents: [
      {
        uri: 'esql://reference',
        mimeType: 'text/markdown',
        text: buildEsqlReference(),
      },
    ],
  })
);

// Register all tools
registerRunEsql(server);
registerListIndices(server);
registerCreateChart(server);
registerCreateMetric(server);
registerCreateHeatmap(server);
registerSectionTools(server);
registerManageDashboard(server);
registerExportToKibana(server);
registerImportFromKibana(server);
registerViewDashboard(server);

// Start preview server automatically
startViteServer();

// Clean up on shutdown
async function shutdown() {
  viteProcess?.kill();
  await closeBrowser();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Connect via stdio (Cursor spawns this process)
const transport = new StdioServerTransport();
await server.connect(transport);
