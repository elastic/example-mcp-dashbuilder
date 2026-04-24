/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync } from 'fs';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, existsSync: vi.fn() };
});

describe('display', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  it('displayBanner prints banner text', async () => {
    const { displayBanner } = await import('./display.js');
    displayBanner();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('displayConfigStatus returns true when .env exists', async () => {
    vi.mocked(existsSync).mockReturnValue(true);
    const { displayConfigStatus } = await import('./display.js');
    const result = displayConfigStatus();
    expect(result).toBe(true);
  });

  it('displayConfigStatus returns false when .env missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const { displayConfigStatus } = await import('./display.js');
    const result = displayConfigStatus();
    expect(result).toBe(false);
  });

  it('displaySummary prints the env path', async () => {
    const { displaySummary } = await import('./display.js');
    displaySummary('/path/to/.env');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('/path/to/.env'));
  });

  it('displayConnectionError prints error message', async () => {
    const { displayConnectionError } = await import('./display.js');
    displayConnectionError('timeout');
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('timeout'));
  });
});
