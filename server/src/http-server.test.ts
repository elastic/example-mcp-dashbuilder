/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Express } from 'express';
import type { Server } from 'http';
import { tryListen, parseHttpFlag } from './http-server.js';

function createMockApp(behavior: 'success' | 'eaddrinuse' | 'eaddrinuse-once' | 'other-error') {
  let callCount = 0;
  const app = {
    listen: vi.fn((_port: number, _host: string, callback: () => void) => {
      callCount++;
      const server = new EventEmitter() as EventEmitter & Server;
      // Attach a fake address method
      (server as unknown as { address: () => { port: number } }).address = () => ({
        port: _port === 0 ? 49152 : _port,
      });

      process.nextTick(() => {
        if (behavior === 'success') {
          callback();
        } else if (behavior === 'eaddrinuse') {
          const err = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
          server.emit('error', err);
        } else if (behavior === 'eaddrinuse-once') {
          if (callCount === 1) {
            const err = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
            server.emit('error', err);
          } else {
            callback();
          }
        } else {
          const err = Object.assign(new Error('EACCES'), { code: 'EACCES' });
          server.emit('error', err);
        }
      });

      return server;
    }),
  } as unknown as Express;
  return app;
}

describe('parseHttpFlag', () => {
  it('returns true when --http is present', () => {
    expect(parseHttpFlag(['node', 'index.js', '--http'])).toBe(true);
  });

  it('returns false when --http is absent', () => {
    expect(parseHttpFlag(['node', 'index.js'])).toBe(false);
  });

  it('returns false for similar but different flags', () => {
    expect(parseHttpFlag(['node', 'index.js', '--https'])).toBe(false);
  });
});

describe('tryListen', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves with the server on success', async () => {
    const app = createMockApp('success');
    const server = await tryListen(app, 3001, '127.0.0.1', { explicitPort: false });
    expect(server).toBeDefined();
    expect(app.listen).toHaveBeenCalledWith(3001, '127.0.0.1', expect.any(Function));
  });

  it('falls back to port 0 on EADDRINUSE when no explicit port', async () => {
    const app = createMockApp('eaddrinuse-once');
    const server = await tryListen(app, 3001, '127.0.0.1', { explicitPort: false });
    expect(server).toBeDefined();
    expect(app.listen).toHaveBeenCalledTimes(2);
    expect(app.listen).toHaveBeenLastCalledWith(0, '127.0.0.1', expect.any(Function));
  });

  it('rejects with a descriptive error on EADDRINUSE when explicit port is set', async () => {
    const app = createMockApp('eaddrinuse');
    await expect(tryListen(app, 4000, '127.0.0.1', { explicitPort: true })).rejects.toThrow(
      'Port 4000 is already in use'
    );
  });

  it('rejects on non-EADDRINUSE errors', async () => {
    const app = createMockApp('other-error');
    await expect(tryListen(app, 3001, '127.0.0.1', { explicitPort: false })).rejects.toThrow(
      'EACCES'
    );
  });
});
