/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { useState, useEffect, useRef } from 'react';
import type { TimeRange } from '../context/TimeRangeContext';
import { useMcpApp } from '../context/McpAppContext';

/** Debounce delay to avoid flooding ES during rapid time-range scrubbing. */
const DEBOUNCE_MS = 150;

interface UseEsqlQueryResult {
  data: Record<string, unknown>[];
  isLoading: boolean;
  error: string | null;
}

export function useEsqlQuery(
  query: string | undefined,
  timeRange: TimeRange | null,
  timeField?: string
): UseEsqlQueryResult {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic counter — only the latest request's results are applied.
  // MCP callServerTool doesn't support AbortSignal, so the server-side
  // query still runs to completion, but stale results are discarded.
  const requestIdRef = useRef(0);
  const mcpApp = useMcpApp();

  useEffect(() => {
    if (!query) {
      setData([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Bump counter immediately so any in-flight request becomes stale
    const currentId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    const args: Record<string, string> = { query };
    if (timeRange) {
      args.start = timeRange.start;
      args.end = timeRange.end;
    }
    if (timeField) {
      args.timeField = timeField;
    }

    // Debounce to coalesce rapid parameter changes (e.g. time range scrubbing)
    const timer = setTimeout(() => {
      mcpApp
        .callServerTool({ name: 'app_only_esql_query', arguments: args })
        .then((result) => {
          if (requestIdRef.current !== currentId) return; // stale

          if (result.isError) {
            const errText = result.content?.find((c: { type: string }) => c.type === 'text') as
              | { text: string }
              | undefined;
            setError(errText?.text || 'ES|QL query failed');
            setIsLoading(false);
          } else {
            try {
              const text = (
                result.content?.find((c: { type: string }) => c.type === 'text') as {
                  text?: string;
                }
              )?.text;
              const parsed = text
                ? (JSON.parse(text) as { rows: Record<string, unknown>[] })
                : null;
              setData(parsed?.rows || []);
            } catch {
              setData([]);
            }
            setIsLoading(false);
          }
        })
        .catch((err: unknown) => {
          if (requestIdRef.current !== currentId) return; // stale
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [query, timeRange, timeField, mcpApp]);

  return { data, isLoading, error };
}
