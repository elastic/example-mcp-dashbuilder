import { useState, useEffect, useRef } from 'react';
import type { TimeRange } from '../context/TimeRangeContext';
import { useMcpApp } from '../context/McpAppContext';

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
  const cancelledRef = useRef(false);
  const mcpApp = useMcpApp();

  useEffect(() => {
    if (!query) {
      setData([]);
      setIsLoading(false);
      return;
    }

    cancelledRef.current = false;
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

    mcpApp
      .callServerTool({ name: 'run_esql_query', arguments: args })
      .then((result) => {
        if (!cancelledRef.current) {
          if (result.isError) {
            const errText = result.content?.find((c: { type: string }) => c.type === 'text') as
              | { text: string }
              | undefined;
            setError(errText?.text || 'ES|QL query failed');
            setIsLoading(false);
          } else {
            const structured = result.structuredContent as
              | { rows: Record<string, unknown>[] }
              | undefined;
            setData(structured?.rows || []);
            setIsLoading(false);
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelledRef.current) {
          setError(err instanceof Error ? err.message : String(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelledRef.current = true;
    };
  }, [query, timeRange, timeField, mcpApp]);

  return { data, isLoading, error };
}
