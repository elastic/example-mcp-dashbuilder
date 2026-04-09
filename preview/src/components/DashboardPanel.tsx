import React, { useMemo } from 'react';
import { EuiCallOut } from '@elastic/eui';
import { PanelChrome } from './PanelChrome';
import { ChartPanel } from './ChartPanel';
import { useEsqlQuery } from '../hooks/useEsqlQuery';
import { useTimeRange } from '../context/TimeRangeContext';
import type { PanelConfig } from '../types';

export function DashboardPanel({ config }: { config: PanelConfig }) {
  const { timeRange } = useTimeRange();
  const { data, isLoading, error } = useEsqlQuery(config.esqlQuery, timeRange, config.timeField);

  // Fetch trend data for metrics with a trend query
  const trendQuery = config.chartType === 'metric' ? config.trendEsqlQuery : undefined;
  const { data: trendData } = useEsqlQuery(trendQuery, timeRange, config.timeField);

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
        <EuiCallOut color="danger" iconType="warning" size="s" title="Query error">
          <p>{error}</p>
        </EuiCallOut>
      ) : (
        <ChartPanel config={liveConfig} />
      )}
    </PanelChrome>
  );
}
