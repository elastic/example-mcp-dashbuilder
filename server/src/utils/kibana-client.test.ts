/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { parseDashboardId } from './kibana-client.js';

describe('parseDashboardId', () => {
  it('extracts UUID from full Kibana URL', () => {
    expect(parseDashboardId('http://localhost:5601/app/dashboards#/view/abc-123-def')).toBe(
      'abc-123-def'
    );
  });

  it('extracts UUID from URL with base path', () => {
    expect(parseDashboardId('http://localhost:5601/kbn/app/dashboards#/view/abc-123')).toBe(
      'abc-123'
    );
  });

  it('returns trimmed string for raw ID', () => {
    expect(parseDashboardId('  abc-123  ')).toBe('abc-123');
  });

  it('returns clean UUID as-is', () => {
    expect(parseDashboardId('abc-123-def-456')).toBe('abc-123-def-456');
  });
});
