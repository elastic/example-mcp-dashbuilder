import { useState, useEffect, useRef } from 'react';
import type { TimeRange } from '../context/TimeRangeContext';
import { BASE_URL } from '../utils/base-url';

interface UseEsqlQueryResult {
  data: Record<string, unknown>[];
  isLoading: boolean;
  error: string | null;
}

export function useEsqlQuery(
  query: string | undefined,
  timeRange: TimeRange | null
): UseEsqlQueryResult {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!query) {
      setData([]);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    const body: Record<string, string> = { query };
    if (timeRange) {
      body.start = timeRange.start;
      body.end = timeRange.end;
    }

    fetch(`${BASE_URL}/api/esql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`ES|QL query failed (${res.status})`);
        return res.json();
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result.rows || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [query, timeRange]);

  return { data, isLoading, error };
}
