/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useEsqlQuery } from './useEsqlQuery';
import { McpAppProvider } from '../context/McpAppContext';

function createMockApp(callServerToolImpl?: (...args: unknown[]) => Promise<unknown>) {
  return {
    callServerTool:
      callServerToolImpl ??
      vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ rows: [], columns: [] }) }],
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createWrapper(app: any) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(McpAppProvider, { app, children });
  };
}

describe('useEsqlQuery', () => {
  beforeEach(() => {
    // advanceTimers: true auto-advances fake timers when promises are pending,
    // allowing waitFor's internal polling to work alongside fake timers.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty data when query is undefined', () => {
    const app = createMockApp();
    const { result } = renderHook(() => useEsqlQuery(undefined, null), {
      wrapper: createWrapper(app),
    });
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls app_only_esql_query tool and returns rows', async () => {
    const rows = [{ host: 'a', count: 10 }];
    const app = createMockApp(
      vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ rows, columns: [{ name: 'host', type: 'keyword' }] }),
          },
        ],
      })
    );

    const { result } = renderHook(
      () => useEsqlQuery('FROM logs | STATS c = COUNT(*) BY host', null),
      { wrapper: createWrapper(app) }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(rows);
    expect(result.current.error).toBeNull();
    expect(app.callServerTool).toHaveBeenCalledWith({
      name: 'app_only_esql_query',
      arguments: { query: 'FROM logs | STATS c = COUNT(*) BY host' },
    });
  });

  it('sends time range and timeField in arguments', async () => {
    const app = createMockApp(
      vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ rows: [] }) }],
      })
    );

    renderHook(() => useEsqlQuery('FROM logs', { start: 'now-15m', end: 'now' }, 'order_date'), {
      wrapper: createWrapper(app),
    });

    await waitFor(() => {
      expect(app.callServerTool).toHaveBeenCalled();
    });

    expect(app.callServerTool).toHaveBeenCalledWith({
      name: 'app_only_esql_query',
      arguments: { query: 'FROM logs', start: 'now-15m', end: 'now', timeField: 'order_date' },
    });
  });

  it('sets error when tool returns isError', async () => {
    const app = createMockApp(
      vi.fn().mockResolvedValue({
        isError: true,
        content: [{ type: 'text', text: 'ES|QL query failed: parse error' }],
      })
    );

    const { result } = renderHook(() => useEsqlQuery('FROM logs', null), {
      wrapper: createWrapper(app),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('parse error');
    expect(result.current.data).toEqual([]);
  });

  it('discards stale results when query changes rapidly', async () => {
    const app = createMockApp(
      vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ rows: [{ x: 2 }] }) }],
      })
    );

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useEsqlQuery(query, null),
      { wrapper: createWrapper(app), initialProps: { query: 'FROM logs-1' } }
    );

    // Change query before debounce fires — first query should be cancelled
    await vi.advanceTimersByTimeAsync(50);
    rerender({ query: 'FROM logs-2' });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Only the second query should have been sent (first was debounced away)
    expect(app.callServerTool).toHaveBeenCalledTimes(1);
    expect(app.callServerTool).toHaveBeenCalledWith({
      name: 'app_only_esql_query',
      arguments: { query: 'FROM logs-2' },
    });
    expect(result.current.data).toEqual([{ x: 2 }]);
  });
});
