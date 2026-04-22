/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { SetupConfig } from './types.js';

const mockInfo = vi.fn();
const mockHasPrivileges = vi.fn();

vi.mock('@elastic/elasticsearch', () => ({
  Client: vi.fn().mockImplementation(() => ({
    info: mockInfo,
    security: { hasPrivileges: mockHasPrivileges },
  })),
}));

describe('testConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cluster name for local connection', async () => {
    mockInfo.mockResolvedValue({ cluster_name: 'my-cluster' });
    const { testConnection } = await import('./connection.js');

    const config: SetupConfig = {
      connectionType: 'local',
      esNode: 'http://localhost:9200',
      username: 'elastic',
      password: 'changeme',
      unsafeSsl: false,
    };

    const result = await testConnection(config);
    expect(result).toBe('cluster: my-cluster');
  });

  it('returns username for serverless connection', async () => {
    mockHasPrivileges.mockResolvedValue({ username: 'admin' });
    const { testConnection } = await import('./connection.js');

    const config: SetupConfig = {
      connectionType: 'cloud-serverless',
      esNode: 'https://my-serverless.es.cloud',
      apiKey: 'key123',
      unsafeSsl: false,
    };

    const result = await testConnection(config);
    expect(result).toBe('user: admin');
  });

  it('uses cloud ID when provided', async () => {
    const { Client } = await import('@elastic/elasticsearch');
    mockInfo.mockResolvedValue({ cluster_name: 'cloud-cluster' });
    const { testConnection } = await import('./connection.js');

    const config: SetupConfig = {
      connectionType: 'cloud-hosted',
      cloudId: 'my-deployment:base64stuff',
      apiKey: 'key',
      unsafeSsl: false,
    };

    await testConnection(config);
    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({ cloud: { id: 'my-deployment:base64stuff' } })
    );
  });

  it('sets rejectUnauthorized false when unsafeSsl is true', async () => {
    const { Client } = await import('@elastic/elasticsearch');
    mockInfo.mockResolvedValue({ cluster_name: 'test' });
    const { testConnection } = await import('./connection.js');

    const config: SetupConfig = {
      connectionType: 'local',
      esNode: 'https://localhost:9200',
      unsafeSsl: true,
    };

    await testConnection(config);
    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({ tls: { rejectUnauthorized: false } })
    );
  });
});
