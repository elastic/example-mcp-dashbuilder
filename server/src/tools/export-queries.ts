/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDashboard } from '../utils/dashboard-store.js';
import { registerTool } from '../utils/register-tool.js';
import type { PanelConfig } from '../types.js';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Map chart types to pandas visualization code. Returns { code, usesMatplotlib }. */
function pandasVisualization(chart: PanelConfig): { code: string; usesMatplotlib: boolean } {
  switch (chart.chartType) {
    case 'bar':
      return {
        code: `df.plot.bar(x="${chart.xField}", y=${JSON.stringify(chart.yFields)}, title="${chart.title}")`,
        usesMatplotlib: true,
      };
    case 'line':
      return {
        code: `df.plot.line(x="${chart.xField}", y=${JSON.stringify(chart.yFields)}, title="${chart.title}")`,
        usesMatplotlib: true,
      };
    case 'area':
      return {
        code: `df.plot.area(x="${chart.xField}", y=${JSON.stringify(chart.yFields)}, title="${chart.title}")`,
        usesMatplotlib: true,
      };
    case 'pie':
      return {
        code: `df.set_index("${chart.xField}")[${JSON.stringify(chart.yFields)}].plot.pie(subplots=True, title="${chart.title}")`,
        usesMatplotlib: true,
      };
    case 'metric':
      return {
        code: `print(f"${chart.title}: {df.iloc[0]['${chart.valueField}']}")`,
        usesMatplotlib: false,
      };
    case 'heatmap':
      return {
        code:
          `import seaborn as sns\n` +
          `pivot = df.pivot_table(index="${chart.yField}", columns="${chart.xField}", values="${chart.valueField}")\n` +
          `sns.heatmap(pivot, annot=True, fmt=".0f", cmap="YlOrRd")\n` +
          `plt.title("${chart.title}")`,
        usesMatplotlib: true,
      };
    default:
      return { code: `display(df)`, usesMatplotlib: false };
  }
}

function buildKibanaConsole(charts: PanelConfig[], title: string): string {
  const lines: string[] = [`# ${title}`, ''];

  for (const chart of charts) {
    lines.push(`# ${chart.title} (${chart.chartType})`);
    lines.push(`POST /_query`);
    lines.push(`{"query": ${JSON.stringify(chart.esqlQuery)}}`);
    lines.push('');

    if (chart.chartType === 'metric' && chart.trendEsqlQuery) {
      lines.push(`# ${chart.title} — trend sparkline`);
      lines.push(`POST /_query`);
      lines.push(`{"query": ${JSON.stringify(chart.trendEsqlQuery)}}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildJupyterNotebook(charts: PanelConfig[], title: string): string {
  const cells: Array<{
    cell_type: 'markdown' | 'code';
    source: string[];
    metadata: Record<string, unknown>;
    outputs?: unknown[];
    execution_count?: null;
  }> = [];

  // Title cell
  cells.push({
    cell_type: 'markdown',
    source: [`# ${title}\n`, '\n', 'Dashboard exported from example-mcp-dashbuilder\n'],
    metadata: {},
  });

  // Setup cell — pre-fill credentials from environment if available
  const esNode = process.env.ES_NODE || 'http://localhost:9200';
  const apiKey = process.env.ES_API_KEY;
  const username = process.env.ES_USERNAME;
  const password = process.env.ES_PASSWORD;

  const authLines: string[] = [];
  if (apiKey) {
    authLines.push(`    api_key="${apiKey}",\n`);
  } else if (username && password) {
    authLines.push(`    basic_auth=("${username}", "${password}"),\n`);
  } else {
    authLines.push('    # api_key="your-api-key-here",\n');
    authLines.push('    # basic_auth=("elastic", "changeme"),\n');
  }

  cells.push({
    cell_type: 'code',
    source: [
      'from elasticsearch import Elasticsearch\n',
      'import pandas as pd\n',
      'import matplotlib.pyplot as plt\n',
      '\n',
      'es = Elasticsearch(\n',
      `    "${esNode}",\n`,
      ...authLines,
      ')\n',
    ],
    metadata: {},
    outputs: [],
    execution_count: null,
  });

  for (const chart of charts) {
    // Markdown header
    cells.push({
      cell_type: 'markdown',
      source: [`## ${chart.title}\n`, `\n`, `Chart type: **${chart.chartType}**\n`],
      metadata: {},
    });

    // Query + visualization cell
    const queryLines = chart.esqlQuery
      .split('\n')
      .map((line, i, arr) => (i < arr.length - 1 ? `    ${line}\n` : `    ${line}\n`));

    const viz = pandasVisualization(chart);

    const vizLines = [
      `result = es.esql.query(\n`,
      `    query="""\n`,
      ...queryLines,
      `    """,\n`,
      `    format="json"\n`,
      `)\n`,
      `\n`,
      `df = pd.DataFrame(result["values"], columns=[c["name"] for c in result["columns"]])\n`,
      `${viz.code}\n`,
    ];

    if (viz.usesMatplotlib) {
      vizLines.push(`plt.tight_layout()\n`);
      vizLines.push(`plt.show()\n`);
    }

    cells.push({
      cell_type: 'code',
      source: vizLines,
      metadata: {},
      outputs: [],
      execution_count: null,
    });

    // Trend cell for metrics
    if (chart.chartType === 'metric' && chart.trendEsqlQuery) {
      const trendLines = chart.trendEsqlQuery.split('\n').map((line) => `    ${line}\n`);

      cells.push({
        cell_type: 'code',
        source: [
          `# ${chart.title} — trend sparkline\n`,
          `trend_result = es.esql.query(\n`,
          `    query="""\n`,
          ...trendLines,
          `    """,\n`,
          `    format="json"\n`,
          `)\n`,
          `\n`,
          `trend_df = pd.DataFrame(trend_result["values"], columns=[c["name"] for c in trend_result["columns"]])\n`,
          `trend_df.plot(title="${chart.title} — Trend")\n`,
          `plt.tight_layout()\n`,
          `plt.show()\n`,
        ],
        metadata: {},
        outputs: [],
        execution_count: null,
      });
    }
  }

  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.11.0',
      },
    },
    cells,
  };

  return JSON.stringify(notebook, null, 2);
}

export function registerExportQueries(server: McpServer): void {
  registerTool(
    server,
    'export_queries',
    {
      title: 'Export Queries',
      description:
        'Export all ES|QL queries from the dashboard as a shareable notebook. ' +
        'Supports two formats: "console" for Kibana Dev Tools, or "jupyter" for a Python notebook. ' +
        'The content is returned as text in the chat — copy and save it.',
      inputSchema: {
        format: z
          .enum(['console', 'jupyter'])
          .describe(
            'Export format: "console" for Kibana Dev Tools queries, "jupyter" for a Python .ipynb notebook.'
          ),
        dashboardId: z
          .string()
          .optional()
          .describe(
            'Target dashboard ID for session isolation. If omitted, uses the active dashboard.'
          ),
      },
    },
    async (args) => {
      const dashboard = getDashboard(args.dashboardId);

      if (dashboard.charts.length === 0) {
        return {
          content: [{ type: 'text', text: 'No charts to export. Create some charts first.' }],
          isError: true,
        };
      }

      if (args.format === 'console') {
        const content = buildKibanaConsole(dashboard.charts, dashboard.title);
        return {
          content: [
            {
              type: 'text',
              text:
                `Kibana Console queries for "${dashboard.title}" (${dashboard.charts.length} queries):\n\n` +
                '```\n' +
                content +
                '```',
            },
          ],
        };
      }

      const content = buildJupyterNotebook(dashboard.charts, dashboard.title);
      const slug = dashboard.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const fileName = `${slug || 'dashboard'}.ipynb`;
      const filePath = resolve(PROJECT_ROOT, fileName);
      writeFileSync(filePath, content);

      return {
        content: [
          {
            type: 'text',
            text:
              `Jupyter notebook for "${dashboard.title}" (${dashboard.charts.length} charts).\n\n` +
              `**Saved to:** \`${fileName}\`\n` +
              `**Open with:** \`jupyter notebook ${fileName}\`\n` +
              `**Requirements:** \`pip install elasticsearch pandas matplotlib seaborn\`\n\n` +
              `The raw notebook JSON is below — you can also paste it directly into Jupyter:`,
          },
          {
            type: 'text',
            text: content,
          },
        ],
      };
    }
  );
}
