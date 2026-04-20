/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { parseDashboardId, parseKibanaStatus, meetsMinVersion } from './kibana-client.js';
import type { KibanaCapabilities } from './kibana-client.js';

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

describe('meetsMinVersion', () => {
  it('returns true for 9.4.0', () => expect(meetsMinVersion('9.4.0')).toBe(true));
  it('returns true for 9.5.0', () => expect(meetsMinVersion('9.5.0')).toBe(true));
  it('returns true for 10.0.0', () => expect(meetsMinVersion('10.0.0')).toBe(true));
  it('returns false for 9.3.0', () => expect(meetsMinVersion('9.3.0')).toBe(false));
  it('returns false for 8.17.0', () => expect(meetsMinVersion('8.17.0')).toBe(false));
  it('returns false for 0.0.0', () => expect(meetsMinVersion('0.0.0')).toBe(false));
  it('handles SNAPSHOT versions', () => expect(meetsMinVersion('9.4.0-SNAPSHOT')).toBe(true));
});

describe('parseKibanaStatus', () => {
  it('parses 9.4.0 as hasDashboardApi', () => {
    expect(parseKibanaStatus({ version: { number: '9.4.0' } })).toEqual<KibanaCapabilities>({
      version: '9.4.0',
      serverless: false,
      hasDashboardApi: true,
    });
  });

  it('parses 8.17.0 as legacy', () => {
    expect(parseKibanaStatus({ version: { number: '8.17.0' } })).toEqual<KibanaCapabilities>({
      version: '8.17.0',
      serverless: false,
      hasDashboardApi: false,
    });
  });

  it('detects serverless as hasDashboardApi regardless of version', () => {
    expect(
      parseKibanaStatus({ version: { number: '9.0.0', build_flavor: 'serverless' } })
    ).toEqual<KibanaCapabilities>({
      version: '9.0.0',
      serverless: true,
      hasDashboardApi: true,
    });
  });

  it('handles missing version field', () => {
    expect(parseKibanaStatus({})).toEqual<KibanaCapabilities>({
      version: '0.0.0',
      serverless: false,
      hasDashboardApi: false,
    });
  });

  it('handles empty version object', () => {
    expect(parseKibanaStatus({ version: {} })).toEqual<KibanaCapabilities>({
      version: '0.0.0',
      serverless: false,
      hasDashboardApi: false,
    });
  });
});
