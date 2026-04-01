import React, { useMemo } from 'react';
import { PanelChrome } from './PanelChrome';
import { ChartPanel } from './ChartPanel';
import { useEsqlQuery } from '../hooks/useEsqlQuery';
import { useTimeRange } from '../context/TimeRangeContext';
import type { PanelConfig } from '../types';

export function DashboardPanel({ config }: { config: PanelConfig }) {
  const { timeRange } = useTimeRange();
  const { data, isLoading, error } = useEsqlQuery(config.esqlQuery, timeRange);

  // Fetch trend data for metrics with a trend query
  const trendQuery = config.chartType === 'metric' ? config.trendEsqlQuery : undefined;
  const { data: trendData } = useEsqlQuery(trendQuery, timeRange);

  const liveConfig = useMemo(() => {
    const base = { ...config, data };
    if (config.chartType === 'metric' && trendData.length > 0) {
      return {
        ...base,
        trend: {
          data: trendData.map((row) => ({
            x: new Date(row[config.trendXField!] as string).getTime(),
            y: Number(row[config.trendYField!]) || 0,
          })),
          shape: config.trendShape || 'area',
        },
      };
    }
    return base;
  }, [config, data, trendData]);

  return (
    <PanelChrome title={config.title} isLoading={isLoading}>
      {error ? (
        <div style={{ padding: 12, color: '#BD271E', fontSize: 13 }}>
          <strong>Query error:</strong> {error}
        </div>
      ) : (
        <ChartPanel config={liveConfig} />
      )}
    </PanelChrome>
  );
}
