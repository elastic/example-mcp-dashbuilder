/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

function jsonrpcRequest(method: string, id: number | string = 1) {
  return { jsonrpc: '2.0', method, params: {}, id };
}

function initializeBody() {
  return {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.0.1' },
    },
    id: 1,
  };
}

async function createSession(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app)
    .post('/mcp')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream')
    .send(initializeBody());

  const sessionId = res.headers['mcp-session-id'] as string;
  expect(sessionId).toBeDefined();
  return sessionId;
}

describe('createApp', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp();
  });

  describe('POST /mcp', () => {
    it('returns 400 for a non-initialize request without a session ID', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send(jsonrpcRequest('tools/list'));

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32000);
    });

    it('creates a session for an initialize request', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send(initializeBody());

      expect(res.status).toBe(200);
      expect(res.headers['mcp-session-id']).toBeDefined();
    });

    it('routes requests with a valid session ID to the existing transport', async () => {
      const sessionId = await createSession(app);

      const res = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId)
        .send(jsonrpcRequest('tools/list'));

      expect(res.status).toBe(200);
    });

    it('returns 400 for an unknown session ID with a non-initialize request', async () => {
      const res = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', 'nonexistent-id')
        .send(jsonrpcRequest('tools/list'));

      expect(res.status).toBe(400);
    });
  });

  describe('GET /mcp', () => {
    it('returns 405 without a session ID', async () => {
      const res = await request(app).get('/mcp');
      expect(res.status).toBe(405);
    });

    it('returns 405 with an invalid session ID', async () => {
      const res = await request(app).get('/mcp').set('mcp-session-id', 'bogus');
      expect(res.status).toBe(405);
    });
  });

  describe('DELETE /mcp', () => {
    it('returns 404 without a session ID', async () => {
      const res = await request(app).delete('/mcp');
      expect(res.status).toBe(404);
    });

    it('returns 404 with an invalid session ID', async () => {
      const res = await request(app).delete('/mcp').set('mcp-session-id', 'bogus');
      expect(res.status).toBe(404);
    });

    it('tears down a valid session', async () => {
      const sessionId = await createSession(app);

      const delRes = await request(app)
        .delete('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId);

      // The transport handles the DELETE; a successful teardown returns 200 or 202.
      expect([200, 202]).toContain(delRes.status);

      // Subsequent requests to the same session should fail.
      const postRes = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId)
        .send(jsonrpcRequest('tools/list'));

      expect(postRes.status).toBe(400);
    });
  });

  describe('transport.onclose cleanup', () => {
    it('removes session from maps when transport closes', async () => {
      const sessionId = await createSession(app);

      // Verify session works before close.
      const before = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId)
        .send(jsonrpcRequest('tools/list'));
      expect(before.status).toBe(200);

      // DELETE triggers transport close which fires onclose cleanup.
      await request(app)
        .delete('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId);

      // Session should no longer be routable.
      const after = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId)
        .send(jsonrpcRequest('tools/list'));
      expect(after.status).toBe(400);
    });
  });

  describe('session sweep timer', () => {
    it('closes sessions idle longer than SESSION_TTL_MS', async () => {
      // Create app under fake timers so the setInterval is captured.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const timedApp = createApp();
      const sessionId = await createSession(timedApp);

      // Advance past TTL (30 min) + sweep interval (5 min).
      await vi.advanceTimersByTimeAsync(36 * 60 * 1000);
      vi.useRealTimers();

      const res = await request(timedApp)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId)
        .send(jsonrpcRequest('tools/list'));

      expect(res.status).toBe(400);
    });
  });

  describe('error handling', () => {
    it('returns 500 when POST handler throws', async () => {
      const sessionId = await createSession(app);

      // Send a malformed body that will cause the transport to throw.
      const res = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('mcp-session-id', sessionId)
        .send('not-json');

      // Depending on express json parsing, this may be 400 (parse error) or 500.
      expect([400, 500]).toContain(res.status);
    });
  });
});
