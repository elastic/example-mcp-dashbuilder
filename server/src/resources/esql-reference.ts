/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { readdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(__dirname, 'esql_docs');

/**
 * Load all ES|QL doc files and organize them by category.
 */
function loadEsqlDocs(): Map<string, string[]> {
  const categories = new Map<string, string[]>();

  const order: Array<{ category: string; prefixes: string[] }> = [
    {
      category: 'Overview & Syntax',
      prefixes: [
        'esql-overview',
        'esql-syntax',
        'esql-operators',
        'esql-binary operators',
        'esql-logical operators',
      ],
    },
    { category: 'Source Commands', prefixes: ['esql-from', 'esql-row', 'esql-show'] },
    {
      category: 'Processing Commands',
      prefixes: [
        'esql-where',
        'esql-eval',
        'esql-stats',
        'esql-stats-by',
        'esql-inlinestats-by',
        'esql-sort',
        'esql-limit',
        'esql-keep',
        'esql-drop',
        'esql-rename',
        'esql-dissect',
        'esql-grok',
        'esql-enrich',
        'esql-fork',
        'esql-mv_expand',
      ],
    },
    {
      category: 'Aggregation Functions',
      prefixes: [
        'esql-count',
        'esql-sum',
        'esql-avg',
        'esql-min',
        'esql-max',
        'esql-median',
        'esql-percentile',
        'esql-count_distinct',
        'esql-values',
        'esql-top',
        'esql-std_dev',
        'esql-weighted_avg',
      ],
    },
    {
      category: 'Date & Time Functions',
      prefixes: [
        'esql-bucket',
        'esql-date_format',
        'esql-date_diff',
        'esql-date_extract',
        'esql-date_trunc',
        'esql-now',
      ],
    },
    {
      category: 'String Functions',
      prefixes: [
        'esql-concat',
        'esql-substring',
        'esql-trim',
        'esql-ltrim',
        'esql-rtrim',
        'esql-to_lower',
        'esql-to_upper',
        'esql-length',
        'esql-split',
        'esql-replace',
        'esql-starts_with',
        'esql-ends_with',
      ],
    },
    {
      category: 'Type Conversion',
      prefixes: [
        'esql-to_string',
        'esql-to_integer',
        'esql-to_long',
        'esql-to_double',
        'esql-to_datetime',
        'esql-to_boolean',
      ],
    },
    {
      category: 'Conditional Functions',
      prefixes: ['esql-case', 'esql-coalesce', 'esql-greatest', 'esql-least'],
    },
    {
      category: 'Math Functions',
      prefixes: [
        'esql-round',
        'esql-ceil',
        'esql-floor',
        'esql-abs',
        'esql-pow',
        'esql-sqrt',
        'esql-log',
        'esql-log10',
        'esql-pi',
      ],
    },
    {
      category: 'Multi-Value Functions',
      prefixes: [
        'esql-mv_count',
        'esql-mv_concat',
        'esql-mv_contains',
        'esql-mv_first',
        'esql-mv_last',
      ],
    },
    { category: 'Search Functions', prefixes: ['esql-kql', 'esql-match'] },
    { category: 'Network Functions', prefixes: ['esql-cidr_match', 'esql-ip_prefix'] },
  ];

  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith('.txt'));
  const fileMap = new Map(files.map((f) => [f.replace('.txt', ''), f]));

  for (const { category, prefixes } of order) {
    const docs: string[] = [];
    for (const prefix of prefixes) {
      const fileName = fileMap.get(prefix);
      if (fileName) {
        const content = readFileSync(resolve(DOCS_DIR, fileName), 'utf-8').trim();
        docs.push(content);
      }
    }
    if (docs.length > 0) {
      categories.set(category, docs);
    }
  }

  return categories;
}

/**
 * Build the full ES|QL reference as a single markdown string.
 */
export function buildEsqlReference(): string {
  const categories = loadEsqlDocs();
  const parts: string[] = ['# ES|QL Reference for Dashboard Visualizations\n'];

  for (const [category, docs] of categories) {
    parts.push(`\n## ${category}\n`);
    for (const doc of docs) {
      parts.push(doc);
      parts.push('');
    }
  }

  parts.push(`
## Common Patterns for Visualizations

### Bar chart — top N categories
\`\`\`esql
FROM index
| STATS value = SUM(field) BY category
| SORT value DESC
| LIMIT 10
\`\`\`

### Line chart — time series
\`\`\`esql
FROM index
| STATS value = COUNT(*) BY BUCKET(@timestamp, 1 day)
| SORT \`BUCKET(@timestamp, 1 day)\`
\`\`\`

### Metric — single aggregated value
\`\`\`esql
FROM index
| STATS total = SUM(field)
\`\`\`

### Metric with trend
\`\`\`esql
-- Main query:
FROM index | STATS total = SUM(field)
-- Trend query:
FROM index | STATS value = SUM(field) BY BUCKET(@timestamp, 1 day) | SORT \`BUCKET(@timestamp, 1 day)\`
\`\`\`

### Heatmap — two-dimensional buckets
\`\`\`esql
FROM index
| EVAL day = DATE_FORMAT("EEEE", @timestamp), hour = DATE_FORMAT("HH", @timestamp)
| STATS count = COUNT(*) BY day, hour
| SORT day, hour
\`\`\`

### Pie chart — part-of-whole (max 6 slices)
\`\`\`esql
FROM index
| STATS count = COUNT(*) BY category
| SORT count DESC
| LIMIT 6
\`\`\`
`);

  return parts.join('\n');
}
