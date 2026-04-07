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
import { FastMCP } from 'fastmcp';
import { runEsqlTools } from './tools/run-esql.js';
import { listIndicesTools } from './tools/list-indices.js';
import { createChartTool } from './tools/create-chart.js';
import { createMetricTool } from './tools/create-metric.js';
import { createHeatmapTool } from './tools/create-heatmap.js';
import { sectionTools } from './tools/create-section.js';
import { manageDashboardTools } from './tools/manage-dashboard.js';
import { exportToKibanaTool } from './tools/export-to-kibana.js';
import { importFromKibanaTool } from './tools/import-from-kibana.js';
import { viewDashboardTools, viewDashboardResources } from './tools/view-dashboard.js';
import { appOnlyTools } from './tools/app-only-tools.js';
import { DATAVIZ_GUIDELINES } from './resources/dataviz-guidelines.js';
import { buildEsqlReference } from './resources/esql-reference.js';

const server = new FastMCP({
  name: 'elastic-dashbuilder',
  version: '0.1.0',
});

// Register dataviz best practices as a resource
server.addResource({
  name: 'dataviz-guidelines',
  uri: 'dataviz://guidelines',
  description:
    'Data visualization best practices for choosing chart types, composing dashboards, ' +
    'writing ES|QL queries for visualizations, and avoiding common anti-patterns. ' +
    'Read this before creating charts or dashboards.',
  mimeType: 'text/markdown',
  load: async () => ({
    text: DATAVIZ_GUIDELINES,
  }),
});

// Register ES|QL reference as a resource
server.addResource({
  name: 'esql-reference',
  uri: 'esql://reference',
  description:
    'ES|QL language reference — commands, functions, operators, and common query patterns ' +
    'for dashboard visualizations. Read this when writing ES|QL queries to ensure correct syntax.',
  mimeType: 'text/markdown',
  load: async () => ({
    text: buildEsqlReference(),
  }),
});

// Register app resources
for (const resource of viewDashboardResources) {
  server.addResource(resource);
}

// Register all tools
// Register all tools
[
  ...runEsqlTools,
  ...listIndicesTools,
  createChartTool,
  createMetricTool,
  createHeatmapTool,
  ...sectionTools,
  ...manageDashboardTools,
  exportToKibanaTool,
  importFromKibanaTool,
  ...viewDashboardTools,
  ...appOnlyTools,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
].forEach((tool: any) => server.addTool(tool));

// Clean up on shutdown
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Connect via stdio (Cursor spawns this process)
server.start({ transportType: 'stdio' });
