/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test loadExistingEnv by mocking the fs reads and the ENV_PATH
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, existsSync: vi.fn(), readFileSync: vi.fn() };
});

describe('loadExistingEnv', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns empty object when .env does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const { loadExistingEnv } = await import('./config.js');
    expect(loadExistingEnv()).toEqual({});
  });

  it('parses key=value pairs from .env file', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      'CONNECTION_TYPE=local\nES_NODE=http://localhost:9200\nES_API_KEY=abc123\n'
    );
    const { loadExistingEnv } = await import('./config.js');
    expect(loadExistingEnv()).toEqual({
      CONNECTION_TYPE: 'local',
      ES_NODE: 'http://localhost:9200',
      ES_API_KEY: 'abc123',
    });
  });

  it('ignores comments and blank lines', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('# comment\n\nES_NODE=http://localhost:9200\n\n');
    const { loadExistingEnv } = await import('./config.js');
    expect(loadExistingEnv()).toEqual({ ES_NODE: 'http://localhost:9200' });
  });

  it('handles values with equals signs', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('ES_API_KEY=abc=def=ghi\n');
    const { loadExistingEnv } = await import('./config.js');
    expect(loadExistingEnv()).toEqual({ ES_API_KEY: 'abc=def=ghi' });
  });
});
