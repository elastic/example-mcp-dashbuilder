/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { inferIntent } from './intent.js';

describe('inferIntent', () => {
  it('maps create_chart to chart type', () => {
    expect(inferIntent('create_chart', { chartType: 'bar' })).toBe('chart:bar');
  });

  it('sizes run_esql by query length', () => {
    expect(inferIntent('run_esql', { query: 'x'.repeat(10) })).toBe('run_esql');
    expect(inferIntent('run_esql', { query: 'x'.repeat(801) })).toBe('run_esql:large');
  });
});
