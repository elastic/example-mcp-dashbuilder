import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useEsqlQuery } from './useEsqlQuery';
import { McpAppProvider } from '../context/McpAppContext';

// Create a mock MCP App
function createMockApp(callServerToolImpl?: (...args: unknown[]) => Promise<unknown>) {
  return {
    callServerTool:
      callServerToolImpl ??
      vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '0 rows' }],
        structuredContent: { rows: [], columns: [] },
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
  it('returns empty data when query is undefined', () => {
    const app = createMockApp();
    const { result } = renderHook(() => useEsqlQuery(undefined, null), {
      wrapper: createWrapper(app),
    });
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('calls run-esql-query tool and returns rows', async () => {
    const rows = [{ host: 'a', count: 10 }];
    const app = createMockApp(
      vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '1 row(s)' }],
        structuredContent: { rows, columns: [{ name: 'host', type: 'keyword' }] },
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
      name: 'run-esql-query',
      arguments: { query: 'FROM logs | STATS c = COUNT(*) BY host' },
    });
  });

  it('sends time range and timeField in arguments', async () => {
    const app = createMockApp(
      vi.fn().mockResolvedValue({
        structuredContent: { rows: [] },
      })
    );

    renderHook(() => useEsqlQuery('FROM logs', { start: 'now-15m', end: 'now' }, 'order_date'), {
      wrapper: createWrapper(app),
    });

    await waitFor(() => {
      expect(app.callServerTool).toHaveBeenCalled();
    });

    expect(app.callServerTool).toHaveBeenCalledWith({
      name: 'run-esql-query',
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
});
