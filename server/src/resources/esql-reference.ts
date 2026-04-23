/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SKILL_DIR = resolve(
  dirname(require.resolve('elastic-agent-skills/package.json')),
  'skills/elasticsearch/elasticsearch-esql'
);

function readSkillFile(name: string): string {
  return readFileSync(resolve(SKILL_DIR, name), 'utf-8').trim();
}

/**
 * Parse SKILL.md into sections keyed by ## heading name.
 */
export function parseSkillSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split('\n');
  let currentHeading = '';
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^## (.+)/);
    if (match) {
      if (currentHeading) {
        sections.set(currentHeading, currentLines.join('\n').trim());
      }
      currentHeading = match[1];
      currentLines = [];
    } else if (currentHeading) {
      currentLines.push(line);
    }
  }
  if (currentHeading) {
    sections.set(currentHeading, currentLines.join('\n').trim());
  }

  return sections;
}

/**
 * Extract specific numbered guidelines from the Guidelines section.
 * Parses markdown numbered list items (1. **Title**: ...) and returns
 * only the requested ones by number.
 */
export function extractGuidelines(guidelinesContent: string, numbers: number[]): string {
  const items: { num: number; text: string }[] = [];
  let current: { num: number; lines: string[] } | null = null;

  for (const line of guidelinesContent.split('\n')) {
    const match = line.match(/^(\d+)\.\s/);
    if (match) {
      if (current) {
        items.push({ num: current.num, text: current.lines.join('\n').trim() });
      }
      current = { num: parseInt(match[1], 10), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    items.push({ num: current.num, text: current.lines.join('\n').trim() });
  }

  return items
    .filter((item) => numbers.includes(item.num))
    .map((item) => item.text)
    .join('\n\n');
}

/**
 * Strip CLI-specific content from extracted skill sections:
 * - bash code blocks
 * - lines referencing `node scripts/esql.js` or `curl`
 * - the ### Environment Configuration subsection
 * - markdown link references to environment-setup.md
 */
export function stripCliInstructions(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let inBashBlock = false;
  let inEnvSection = false;

  for (const line of lines) {
    // Skip bash code blocks
    if (line.trim().startsWith('```bash')) {
      inBashBlock = true;
      continue;
    }
    if (inBashBlock) {
      if (line.trim() === '```') {
        inBashBlock = false;
      }
      continue;
    }

    // Skip ### Environment Configuration subsection
    if (line.match(/^### Environment Configuration/)) {
      inEnvSection = true;
      continue;
    }
    if (inEnvSection) {
      if (line.match(/^###? /) && !line.match(/^### Environment/)) {
        inEnvSection = false;
      } else {
        continue;
      }
    }

    // Skip lines with CLI tool references
    if (line.match(/node scripts\/esql\.js/) || line.match(/^Run `node scripts/)) {
      continue;
    }

    result.push(line);
  }

  // Clean up multiple consecutive blank lines
  return result.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Build the full ES|QL reference as a single markdown string.
 * Sources the core reference from the @elastic/agent-skills ES|QL skill,
 * then appends MCP-specific visualization patterns.
 */
export function buildEsqlReference(): string {
  const skillContent = readSkillFile('SKILL.md');
  const sections = parseSkillSections(skillContent);

  // Extract relevant sections from SKILL.md
  const whatIsEsql = sections.get('What is ES|QL?') ?? '';
  const guidelines = sections.get('Guidelines') ?? '';
  const errorHandling = sections.get('Error Handling') ?? '';

  // Guidelines 2 (prefer simplicity paragraph), 3 (choose right feature), 5 (query generation principles)
  const selectedGuidelines = stripCliInstructions(extractGuidelines(guidelines, [2, 3, 5]));

  const parts: string[] = [
    '# ES|QL Reference for Dashboard Visualizations\n',
    '## About ES|QL\n',
    stripCliInstructions(whatIsEsql),
    '\n## Query Generation Guidelines\n',
    selectedGuidelines,
    '\n## Error Handling\n',
    stripCliInstructions(errorHandling),
    '\n---\n',
    readSkillFile('references/esql-reference.md'),
    '\n---\n',
    readSkillFile('references/generation-tips.md'),
    '\n---\n',
    readSkillFile('references/query-patterns.md'),
    '\n---\n',
    readSkillFile('references/time-series-queries.md'),
    '\n---\n',
    readSkillFile('references/esql-search.md'),
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
