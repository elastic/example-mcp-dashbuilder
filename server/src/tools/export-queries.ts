/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getDashboard } from '../utils/dashboard-store.js';
import { registerTool } from '../utils/register-tool.js';
import { translateDashboardToSavedObject } from '../utils/dashboard-translator.js';
import { parseIndexPattern } from '../utils/esql-parser.js';
import { detectTimeField } from '../utils/time-field.js';
import type { DashboardConfig, PanelConfig } from '../types.js';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const JUPYTER_EXPORT_DIR = resolve(PROJECT_ROOT, 'jupyter-exports');
const KIBANA_EXPORT_DIR = resolve(PROJECT_ROOT, 'kibana-exports');

/** Quote a string as a valid Python literal (reuses JSON string syntax). */
function pyStr(value: string): string {
  return JSON.stringify(value);
}

/** Escape a user-controlled string for safe interpolation into HTML text content. */
function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Collapse any CR/LF into a single space so the value is safe inside a single-line comment. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ');
}

/**
 * Make an ES|QL query safe to embed inside a Python triple-quoted string.
 * ES|QL supports `"""..."""` literals (for regex patterns), which would otherwise
 * close the enclosing Python block and allow arbitrary code to follow.
 */
function escapeForPyTripleQuote(query: string): string {
  return query.replace(/"""/g, '\\"\\"\\"');
}

/** Map chart types to pandas visualization code. Returns { code, usesMatplotlib }. */
export function pandasVisualization(chart: PanelConfig): { code: string; usesMatplotlib: boolean } {
  switch (chart.chartType) {
    case 'bar':
      return {
        code: `df.plot.bar(x=${pyStr(chart.xField)}, y=${JSON.stringify(chart.yFields)}, title=${pyStr(chart.title)})`,
        usesMatplotlib: true,
      };
    case 'line':
      return {
        code: `df.plot.line(x=${pyStr(chart.xField)}, y=${JSON.stringify(chart.yFields)}, title=${pyStr(chart.title)})`,
        usesMatplotlib: true,
      };
    case 'area':
      return {
        code: `df.plot.area(x=${pyStr(chart.xField)}, y=${JSON.stringify(chart.yFields)}, title=${pyStr(chart.title)})`,
        usesMatplotlib: true,
      };
    case 'pie':
      return {
        code: `df.set_index(${pyStr(chart.xField)})[${JSON.stringify(chart.yFields)}].plot.pie(subplots=True, title=${pyStr(chart.title)})`,
        usesMatplotlib: true,
      };
    case 'metric':
      return {
        code:
          `from IPython.display import HTML, display\n` +
          `from html import escape\n` +
          `value = df.iloc[0][${pyStr(chart.valueField)}]\n` +
          `display(HTML(f'''\n` +
          `<div style="padding: 20px 24px; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; display: inline-block; min-width: 220px;">\n` +
          `  <div style="font-size: 13px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${htmlEscape(chart.title)}</div>\n` +
          `  <div style="font-size: 42px; font-weight: 600; color: #1a1a1a; line-height: 1;">{escape(str(value))}</div>\n` +
          `</div>\n` +
          `'''))`,
        usesMatplotlib: false,
      };
    case 'heatmap':
      return {
        code:
          `pivot = df.pivot_table(index=${pyStr(chart.yField)}, columns=${pyStr(chart.xField)}, values=${pyStr(chart.valueField)})\n` +
          `fig, ax = plt.subplots()\n` +
          `im = ax.imshow(pivot.values, cmap="YlOrRd", aspect="auto")\n` +
          `ax.set_xticks(range(len(pivot.columns)))\n` +
          `ax.set_xticklabels(pivot.columns, rotation=45, ha="right")\n` +
          `ax.set_yticks(range(len(pivot.index)))\n` +
          `ax.set_yticklabels(pivot.index)\n` +
          `for i in range(pivot.shape[0]):\n` +
          `    for j in range(pivot.shape[1]):\n` +
          `        ax.text(j, i, f"{pivot.values[i, j]:.0f}", ha="center", va="center")\n` +
          `fig.colorbar(im, ax=ax)\n` +
          `ax.set_title(${pyStr(chart.title)})`,
        usesMatplotlib: true,
      };
    default:
      return { code: `display(df)`, usesMatplotlib: false };
  }
}

export function buildKibanaConsole(charts: PanelConfig[], title: string): string {
  const lines: string[] = [`# ${singleLine(title)}`, ''];

  for (const chart of charts) {
    lines.push(`# ${singleLine(chart.title)} (${chart.chartType})`);
    lines.push(`POST /_query`);
    lines.push(`{"query": ${JSON.stringify(chart.esqlQuery)}}`);
    lines.push('');

    if (chart.chartType === 'metric' && chart.trendEsqlQuery) {
      lines.push(`# ${singleLine(chart.title)} — trend sparkline`);
      lines.push(`POST /_query`);
      lines.push(`{"query": ${JSON.stringify(chart.trendEsqlQuery)}}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function buildJupyterNotebook(charts: PanelConfig[], title: string): string {
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
    source: [
      `# ${singleLine(title)}\n`,
      '\n',
      'Dashboard exported from example-mcp-dashbuilder\n',
      '\n',
      'Credentials are read from a `.env` file (see setup cell) or from your environment: `ES_NODE`, and `ES_API_KEY` or `ES_USERNAME`/`ES_PASSWORD`. For self-signed TLS (e.g. local dev), set `UNSAFE_SSL=true` — same as `npm run setup`.\n',
    ],
    metadata: {},
  });

  // Setup cell — load .env (stdlib only; no python-dotenv) then read credentials from the environment
  cells.push({
    cell_type: 'code',
    source: [
      'import os\n',
      'import re\n',
      'from pathlib import Path\n',
      'from elasticsearch import Elasticsearch\n',
      'import pandas as pd\n',
      'import matplotlib.pyplot as plt\n',
      '\n',
      '\n',
      'def _load_dotenv(path: Path) -> None:\n',
      '    """Parse KEY=VALUE lines; skip # comments and empty lines."""\n',
      '    try:\n',
      '        text = path.read_text(encoding="utf-8")\n',
      '    except OSError:\n',
      '        return\n',
      '    for line in text.splitlines():\n',
      '        line = line.strip()\n',
      '        if not line or line.startswith("#"):\n',
      '            continue\n',
      '        m = re.match(r"^([A-Z_]+)=(.*)$", line)\n',
      '        if not m:\n',
      '            continue\n',
      '        key, value = m.group(1), m.group(2)\n',
      '        if key not in os.environ:\n',
      '            os.environ[key] = value\n',
      '\n',
      '\n',
      '# Find .env walking up from cwd (e.g. repo root when this file is under jupyter-exports/)\n',
      '_p = Path.cwd()\n',
      'for _ in range(8):\n',
      '    _env = _p / ".env"\n',
      '    if _env.is_file():\n',
      '        _load_dotenv(_env)\n',
      '        break\n',
      '    if _p == _p.parent:\n',
      '        break\n',
      '    _p = _p.parent\n',
      '\n',
      'es_node = os.environ.get("ES_NODE", "http://localhost:9200")\n',
      'es_api_key = os.environ.get("ES_API_KEY")\n',
      'es_username = os.environ.get("ES_USERNAME")\n',
      'es_password = os.environ.get("ES_PASSWORD")\n',
      'unsafe_ssl = os.environ.get("UNSAFE_SSL", "false").lower() in ("true", "1", "yes")\n',
      'verify_certs = not (unsafe_ssl)\n',
      'kwargs = {}\n',
      'if not verify_certs:\n',
      '    import urllib3\n',
      '    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)\n',
      '    kwargs["verify_certs"] = False\n',
      '    kwargs["ssl_show_warn"] = False\n',
      '\n',
      'if es_api_key:\n',
      '    es = Elasticsearch(es_node, api_key=es_api_key, **kwargs)\n',
      'elif es_username and es_password:\n',
      '    es = Elasticsearch(es_node, basic_auth=(es_username, es_password), **kwargs)\n',
      'else:\n',
      '    es = Elasticsearch(es_node, **kwargs)\n',
    ],
    metadata: {},
    outputs: [],
    execution_count: null,
  });

  for (const chart of charts) {
    // Markdown header
    cells.push({
      cell_type: 'markdown',
      source: [`## ${singleLine(chart.title)}\n`, `\n`, `Chart type: **${chart.chartType}**\n`],
      metadata: {},
    });

    // Query + visualization cell
    const queryLines = escapeForPyTripleQuote(chart.esqlQuery)
      .split('\n')
      .map((line) => `    ${line}\n`);

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
      const trendLines = escapeForPyTripleQuote(chart.trendEsqlQuery)
        .split('\n')
        .map((line) => `    ${line}\n`);

      const trendTitle = pyStr(`${chart.title} — Trend`);
      const trendPlotLine =
        chart.trendXField && chart.trendYField
          ? `trend_df.plot(x=${pyStr(chart.trendXField)}, y=${pyStr(chart.trendYField)}, title=${trendTitle})\n`
          : `trend_df.plot(title=${trendTitle})\n`;

      cells.push({
        cell_type: 'code',
        source: [
          `# ${singleLine(chart.title)} — trend sparkline\n`,
          `trend_result = es.esql.query(\n`,
          `    query="""\n`,
          ...trendLines,
          `    """,\n`,
          `    format="json"\n`,
          `)\n`,
          `\n`,
          `trend_df = pd.DataFrame(trend_result["values"], columns=[c["name"] for c in trend_result["columns"]])\n`,
          trendPlotLine,
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

export async function buildKibanaNdjson(dashboard: DashboardConfig): Promise<string> {
  const timeFieldMap = new Map<string, string>();
  const seenIndices = new Set<string>();
  for (const chart of dashboard.charts) {
    if (!chart.esqlQuery) continue;
    const index = parseIndexPattern(chart.esqlQuery);
    if (!index || seenIndices.has(index)) continue;
    seenIndices.add(index);

    if (chart.timeField) {
      timeFieldMap.set(index, chart.timeField);
    } else {
      const detected = await detectTimeField(index);
      if (detected) timeFieldMap.set(index, detected);
    }
  }

  const { attributes, references } = translateDashboardToSavedObject(dashboard, timeFieldMap);

  const savedObject = {
    attributes,
    id: randomUUID(),
    references,
    type: 'dashboard',
    managed: false,
  };

  const summary = {
    exportedCount: 1,
    missingRefCount: 0,
    missingReferences: [],
    excludedObjects: [],
    excludedObjectsCount: 0,
  };

  return `${JSON.stringify(savedObject)}\n${JSON.stringify(summary)}\n`;
}

export function registerExportQueries(server: McpServer): void {
  registerTool(
    server,
    'export_queries',
    {
      title: 'Export Queries',
      description:
        'Export the dashboard in a shareable format. ' +
        'Supports three formats: "console" for Kibana Dev Tools queries, ' +
        '"jupyter" for a Python .ipynb notebook, ' +
        'or "ndjson" for a Kibana saved-object file that can be committed to a repo or imported into Kibana via Stack Management → Saved Objects.',
      inputSchema: {
        format: z
          .enum(['console', 'jupyter', 'ndjson'])
          .describe(
            'Export format: "console" for Kibana Dev Tools queries, "jupyter" for a Python .ipynb notebook, "ndjson" for a Kibana saved-object export file.'
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

      const slug =
        dashboard.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'dashboard';

      if (args.format === 'ndjson') {
        const ndjson = await buildKibanaNdjson(dashboard);
        const fileName = `${slug}.ndjson`;
        mkdirSync(KIBANA_EXPORT_DIR, { recursive: true });
        writeFileSync(resolve(KIBANA_EXPORT_DIR, fileName), ndjson);
        const relativePath = `kibana-exports/${fileName}`;

        return {
          content: [
            {
              type: 'text',
              text:
                `Kibana NDJSON export for "${dashboard.title}" (${dashboard.charts.length} charts).\n\n` +
                `**Saved to:** \`${relativePath}\`\n` +
                `**Import via:** Kibana → Stack Management → Saved Objects → Import`,
            },
          ],
        };
      }

      const content = buildJupyterNotebook(dashboard.charts, dashboard.title);
      const fileName = `${slug}.ipynb`;
      mkdirSync(JUPYTER_EXPORT_DIR, { recursive: true });
      const filePath = resolve(JUPYTER_EXPORT_DIR, fileName);
      const relativePath = `jupyter-exports/${fileName}`;
      writeFileSync(filePath, content);

      return {
        content: [
          {
            type: 'text',
            text:
              `Jupyter notebook for "${dashboard.title}" (${dashboard.charts.length} charts).\n\n` +
              `**Saved to:** \`${relativePath}\`\n` +
              `**Open with:** \`jupyter notebook ${relativePath}\`\n` +
              `**Requirements:** \`pip install elasticsearch jupyter pandas matplotlib\`\n\n` +
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
