/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import {
  buildEsqlReference,
  parseSkillSections,
  extractGuidelines,
  stripCliInstructions,
} from './esql-reference.js';

describe('parseSkillSections', () => {
  it('parses ## headings into a map', () => {
    const md = `# Title\nPreamble\n## Section A\nContent A\n## Section B\nContent B`;
    const sections = parseSkillSections(md);
    expect(sections.get('Section A')).toBe('Content A');
    expect(sections.get('Section B')).toBe('Content B');
    expect(sections.has('Title')).toBe(false);
  });

  it('handles multi-line section content', () => {
    const md = `## Intro\nLine 1\nLine 2\n\nLine 3\n## Next\nOther`;
    const sections = parseSkillSections(md);
    expect(sections.get('Intro')).toBe('Line 1\nLine 2\n\nLine 3');
  });
});

describe('extractGuidelines', () => {
  const guidelines = [
    '1. **First**: Do A',
    '',
    '   More about A.',
    '',
    '2. **Second**: Do B',
    '',
    '   More about B.',
    '',
    '3. **Third**: Do C',
  ].join('\n');

  it('extracts requested numbered guidelines', () => {
    const result = extractGuidelines(guidelines, [1, 3]);
    expect(result).toContain('**First**: Do A');
    expect(result).toContain('**Third**: Do C');
    expect(result).not.toContain('**Second**');
  });

  it('preserves continuation lines', () => {
    const result = extractGuidelines(guidelines, [1]);
    expect(result).toContain('More about A.');
  });

  it('returns empty string for non-existent numbers', () => {
    const result = extractGuidelines(guidelines, [99]);
    expect(result).toBe('');
  });
});

describe('stripCliInstructions', () => {
  it('strips bash code blocks', () => {
    const input = 'Before\n```bash\nnode scripts/esql.js test\n```\nAfter';
    expect(stripCliInstructions(input)).toBe('Before\nAfter');
  });

  it('strips ### Environment Configuration subsection', () => {
    const input = [
      'Intro',
      '### Environment Configuration',
      'env stuff',
      'more env',
      '### Other Section',
      'kept',
    ].join('\n');
    const result = stripCliInstructions(input);
    expect(result).toContain('Intro');
    expect(result).not.toContain('env stuff');
    expect(result).toContain('### Other Section');
    expect(result).toContain('kept');
  });

  it('strips lines referencing node scripts/esql.js', () => {
    const input = 'Good line\nRun `node scripts/esql.js test` to verify.\nAnother good line';
    const result = stripCliInstructions(input);
    expect(result).toContain('Good line');
    expect(result).toContain('Another good line');
    expect(result).not.toContain('node scripts/esql.js');
  });

  it('collapses multiple blank lines', () => {
    const input = 'A\n\n\n\n\nB';
    expect(stripCliInstructions(input)).toBe('A\n\nB');
  });
});

describe('buildEsqlReference', () => {
  const reference = buildEsqlReference();

  // --- Expected ## headings from SKILL.md ---

  it('includes the expected top-level headings from SKILL.md', () => {
    const skillPortion = reference.slice(0, reference.indexOf('# ES|QL Complete Reference'));
    expect(skillPortion).toContain('## About ES|QL');
    expect(skillPortion).toContain('## Query Generation Guidelines');
    expect(skillPortion).toContain('## Error Handling');
  });

  // --- Content extracted from SKILL.md ---

  it('includes the _source prerequisite warning', () => {
    expect(reference).toContain('ES|QL requires `_source` to be enabled');
  });

  it('includes version compatibility / cluster detection', () => {
    expect(reference).toContain('build_flavor: "serverless"');
    expect(reference).toContain('build_flavor: "default"');
  });

  it('includes the "prefer simplicity" guideline', () => {
    expect(reference).toContain('Prefer simplicity');
    expect(reference).toContain('Query a single index unless the user explicitly asks');
  });

  it('includes the intent-to-feature decision tree', () => {
    expect(reference).toContain('CATEGORIZE(field)');
    expect(reference).toContain('CHANGE_POINT value ON key');
  });

  it('includes query generation principles', () => {
    expect(reference).toContain('Prefer the **simplest query**');
  });

  it('includes error handling gotchas', () => {
    expect(reference).toContain('`STD_DEV()` not `STDDEV()`');
    expect(reference).toContain('`"hour_of_day"` not `"hour"`');
    expect(reference).toContain('double quotes');
  });

  // --- SKILL.md-extracted sections should not contain CLI-specific content ---

  it('does not contain CLI tool references in SKILL.md-extracted sections', () => {
    // Check only the content before the first reference file ("# ES|QL Complete Reference")
    const skillPortion = reference.slice(0, reference.indexOf('# ES|QL Complete Reference'));
    expect(skillPortion).not.toMatch(/node scripts\/esql\.js/);
    expect(skillPortion).not.toContain('```bash');
    expect(skillPortion).not.toContain('### Environment Configuration');
  });

  // --- Reference files from agent-skills ---

  it('includes the core ES|QL reference', () => {
    expect(reference).toContain('# ES|QL Complete Reference');
  });

  it('includes generation tips', () => {
    expect(reference).toContain('Generation Tips');
  });

  it('includes query patterns', () => {
    expect(reference).toContain('Query Patterns');
  });

  it('includes time series reference', () => {
    expect(reference).toContain('TBUCKET');
    expect(reference).toContain('RATE');
  });

  it('includes search reference', () => {
    expect(reference).toContain('MATCH');
    expect(reference).toContain('QSTR');
  });

  // --- MCP-specific visualization patterns ---

  it('includes visualization patterns', () => {
    expect(reference).toContain('## Common Patterns for Visualizations');
    expect(reference).toContain('Bar chart');
    expect(reference).toContain('Line chart');
    expect(reference).toContain('Metric');
    expect(reference).toContain('Heatmap');
    expect(reference).toContain('Pie chart');
  });
});
