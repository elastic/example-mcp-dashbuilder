/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync } from 'fs';

import type { SetupConfig } from './types.js';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, writeFileSync: vi.fn() };
});

describe('writeEnvFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes all fields for a local config', async () => {
    const { writeEnvFile } = await import('./env.js');
    const config: SetupConfig = {
      connectionType: 'local',
      esNode: 'http://localhost:9200',
      username: 'elastic',
      password: 'changeme',
      kibanaUrl: 'http://localhost:5601',
      unsafeSsl: false,
    };

    writeEnvFile(config);

    expect(writeFileSync).toHaveBeenCalledOnce();
    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('CONNECTION_TYPE=local');
    expect(written).toContain('ES_NODE=http://localhost:9200');
    expect(written).toContain('ES_USERNAME=elastic');
    expect(written).toContain('ES_PASSWORD=changeme');
    expect(written).toContain('KIBANA_URL=http://localhost:5601');
    expect(written).not.toContain('UNSAFE_SSL');
    expect(written).not.toContain('ES_CLOUD_ID');
    expect(written).not.toContain('ES_API_KEY');
  });

  it('writes cloud config with API key', async () => {
    const { writeEnvFile } = await import('./env.js');
    const config: SetupConfig = {
      connectionType: 'cloud-hosted',
      cloudId: 'my-cloud:abc',
      apiKey: 'secret-key',
      kibanaUrl: 'https://my-kibana.cloud',
      unsafeSsl: false,
    };

    writeEnvFile(config);

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('CONNECTION_TYPE=cloud-hosted');
    expect(written).toContain('ES_CLOUD_ID=my-cloud:abc');
    expect(written).toContain('ES_API_KEY=secret-key');
    expect(written).not.toContain('ES_USERNAME');
    expect(written).not.toContain('ES_PASSWORD');
    expect(written).not.toContain('ES_NODE');
  });

  it('includes UNSAFE_SSL when enabled', async () => {
    const { writeEnvFile } = await import('./env.js');
    const config: SetupConfig = {
      connectionType: 'local',
      esNode: 'https://localhost:9200',
      unsafeSsl: true,
    };

    writeEnvFile(config);

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    expect(written).toContain('UNSAFE_SSL=true');
  });

  it('omits empty optional fields', async () => {
    const { writeEnvFile } = await import('./env.js');
    const config: SetupConfig = {
      connectionType: 'local',
      unsafeSsl: false,
    };

    writeEnvFile(config);

    const written = vi.mocked(writeFileSync).mock.calls[0][1] as string;
    const lines = written.trim().split('\n');
    expect(lines).toEqual(['CONNECTION_TYPE=local']);
  });
});
