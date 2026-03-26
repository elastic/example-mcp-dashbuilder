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
import { registerViewDashboard } from './tools/view-dashboard.js';
import { closeBrowser } from './utils/chart-renderer.js';
import { DATAVIZ_GUIDELINES } from './resources/dataviz-guidelines.js';
import { buildEsqlReference } from './resources/esql-reference.js';

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
registerViewDashboard(server);

// Clean up browser on shutdown
process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

// Connect via stdio (Cursor spawns this process)
const transport = new StdioServerTransport();
await server.connect(transport);
