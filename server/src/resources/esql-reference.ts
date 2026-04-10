/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '../../vendor/agent-skills/elasticsearch-esql/references');

function readSkillFile(name: string): string {
  return readFileSync(resolve(SKILL_DIR, name), 'utf-8').trim();
}

/**
 * Build the full ES|QL reference as a single markdown string.
 * Sources the core reference from the @elastic/agent-skills ES|QL skill,
 * then appends MCP-specific visualization patterns.
 */
export function buildEsqlReference(): string {
  const parts: string[] = [
    readSkillFile('esql-reference.md'),
    '\n---\n',
    readSkillFile('generation-tips.md'),
    '\n---\n',
    readSkillFile('query-patterns.md'),
    '\n---\n',
    readSkillFile('time-series-queries.md'),
    '\n---\n',
    readSkillFile('esql-search.md'),
    `
---

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
`,
  ];

  return parts.join('\n');
}
