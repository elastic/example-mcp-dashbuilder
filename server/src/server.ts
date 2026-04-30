/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
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
import { registerAppOnlyTools } from './tools/app-only-tools.js';
import { registerExportQueries } from './tools/export-queries.js';
import { registerExportChartImage } from './tools/export-chart-image.js';
import { DATAVIZ_GUIDELINES } from './resources/dataviz-guidelines.js';
import { buildEsqlReference } from './resources/esql-reference.js';
import { ANALYSIS_GUIDELINES } from './resources/analysis-guidelines.js';
import { SERVER_INSTRUCTIONS } from './resources/instructions.js';

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: 'example-mcp-dashbuilder',
      version: '0.1.0',
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    }
  );

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

  // Register deep-analysis guide as a resource
  server.resource(
    'analysis-guidelines',
    'analysis://guidelines',
    {
      description:
        'Deep-analysis guidelines — structured exploration flow for open-ended questions like ' +
        '"analyze my data" or "what\'s interesting in <index>". Defines trigger phrases, ' +
        'the four-section response structure, drill-down suggestions, and on-demand ' +
        'capabilities (field stats, correlations, time-over-time). Read this when the user ' +
        'asks for insight rather than a specific chart.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'analysis://guidelines',
          mimeType: 'text/markdown',
          text: ANALYSIS_GUIDELINES,
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
  registerAppOnlyTools(server);
  registerExportQueries(server);
  registerExportChartImage(server);

  return server;
}
