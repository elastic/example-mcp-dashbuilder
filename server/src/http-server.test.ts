/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { AddressInfo } from 'net';
import type { Server } from 'http';
import express from 'express';
import { describe, it, expect, afterEach } from 'vitest';
import { tryListen, parseHttpFlag } from './http-server.js';

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
  const servers: Server[] = [];

  function track(server: Server): Server {
    servers.push(server);
    return server;
  }

  afterEach(async () => {
    await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
    servers.length = 0;
  });

  it('resolves with the server on success', async () => {
    const server = track(await tryListen(express(), 0, '127.0.0.1', { explicitPort: false }));
    expect(server).toBeDefined();
    expect((server.address() as AddressInfo).port).toBeGreaterThan(0);
  });

  it('falls back to an OS-assigned port on EADDRINUSE when no explicit port', async () => {
    const blocker = track(await tryListen(express(), 0, '127.0.0.1', { explicitPort: false }));
    const occupiedPort = (blocker.address() as AddressInfo).port;

    const server = track(
      await tryListen(express(), occupiedPort, '127.0.0.1', { explicitPort: false })
    );
    const assignedPort = (server.address() as AddressInfo).port;
    expect(assignedPort).not.toBe(occupiedPort);
  });

  it('rejects with a descriptive error on EADDRINUSE when explicit port is set', async () => {
    const blocker = track(await tryListen(express(), 0, '127.0.0.1', { explicitPort: false }));
    const occupiedPort = (blocker.address() as AddressInfo).port;

    await expect(
      tryListen(express(), occupiedPort, '127.0.0.1', { explicitPort: true })
    ).rejects.toThrow(`Port ${occupiedPort} is already in use`);
  });

  it('rejects on non-EADDRINUSE errors', async () => {
    // Listening on an invalid host triggers an EADDRNOTAVAIL error
    await expect(tryListen(express(), 0, '240.0.0.1', { explicitPort: false })).rejects.toThrow();
  });
});
