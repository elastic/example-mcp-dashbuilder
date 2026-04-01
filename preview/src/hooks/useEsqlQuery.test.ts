import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEsqlQuery } from './useEsqlQuery';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock BASE_URL
vi.mock('../utils/base-url', () => ({ BASE_URL: '' }));

function jsonResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(data),
  });
}

describe('useEsqlQuery', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns empty data and no loading when query is undefined', () => {
    const { result } = renderHook(() => useEsqlQuery(undefined, null));
    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('fetches data and sets loading states', async () => {
    const rows = [{ host: 'a', count: 10 }];
    mockFetch.mockReturnValue(jsonResponse({ rows }));

    const { result } = renderHook(() =>
      useEsqlQuery('FROM logs | STATS c = COUNT(*) BY host', null)
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(rows);
    expect(result.current.error).toBeNull();
  });

  it('sends time range when provided', async () => {
    mockFetch.mockReturnValue(jsonResponse({ rows: [] }));

    renderHook(() => useEsqlQuery('FROM logs', { start: 'now-15m', end: 'now' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.start).toBe('now-15m');
    expect(body.end).toBe('now');
  });

  it('sends timeField when provided', async () => {
    mockFetch.mockReturnValue(jsonResponse({ rows: [] }));

    renderHook(() => useEsqlQuery('FROM logs', { start: 'now-1h', end: 'now' }, 'order_date'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.timeField).toBe('order_date');
  });

  it('sets error on fetch failure', async () => {
    mockFetch.mockReturnValue(jsonResponse(null, false));

    const { result } = renderHook(() => useEsqlQuery('FROM logs', null));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toContain('failed');
    expect(result.current.data).toEqual([]);
  });

  it('aborts previous request when query changes', async () => {
    let resolveFirst: (value: unknown) => void;
    const firstRequest = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    mockFetch
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(jsonResponse({ rows: [{ x: 2 }] }));

    const { result, rerender } = renderHook(({ query }) => useEsqlQuery(query, null), {
      initialProps: { query: 'FROM logs-1' },
    });

    // Change query before first resolves
    rerender({ query: 'FROM logs-2' });

    // Resolve first (should be ignored due to abort)
    resolveFirst!({ ok: true, json: () => Promise.resolve({ rows: [{ x: 1 }] }) });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have data from second query, not first
    expect(result.current.data).toEqual([{ x: 2 }]);
  });
});
