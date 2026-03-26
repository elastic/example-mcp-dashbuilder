import { useState, useEffect, useRef } from 'react';

interface ChartConfig {
  id: string;
  title: string;
  chartType: 'bar' | 'line' | 'area' | 'pie';
  esqlQuery: string;
  xField: string;
  yFields: string[];
  splitField?: string;
  data: Record<string, unknown>[];
}

interface MetricConfig {
  id: string;
  title: string;
  chartType: 'metric';
  subtitle?: string;
  color?: string;
  value: number;
  valuePrefix?: string;
  valueSuffix?: string;
  esqlQuery: string;
  trend?: {
    data: Array<{ x: number; y: number }>;
    shape: 'area' | 'bars';
  };
}

interface HeatmapConfig {
  id: string;
  title: string;
  chartType: 'heatmap';
  esqlQuery: string;
  xField: string;
  yField: string;
  valueField: string;
  data: Record<string, unknown>[];
}

export type PanelConfig = ChartConfig | MetricConfig | HeatmapConfig;

export interface SectionConfig {
  id: string;
  title: string;
  collapsed: boolean;
  panelIds: string[];
}

export interface DashboardConfig {
  title: string;
  charts: PanelConfig[];
  sections: SectionConfig[];
  updatedAt: string;
}

const EMPTY_DASHBOARD: DashboardConfig = {
  title: 'Untitled Dashboard',
  charts: [],
  sections: [],
  updatedAt: '',
};

export function useDashboardConfig(): DashboardConfig {
  const [config, setConfig] = useState<DashboardConfig>(EMPTY_DASHBOARD);
  const lastJsonRef = useRef('');

  useEffect(() => {
    async function fetchConfig() {
      try {
        // Use absolute URL when running inside MCP App sandbox (different origin)
        const baseUrl =
          window.location.protocol === 'https:' || window.location.hostname !== 'localhost'
            ? 'http://localhost:5173'
            : '';
        const res = await fetch(`${baseUrl}/dashboard.json?t=${Date.now()}`);
        if (res.ok) {
          const text = await res.text();
          // Strip gridLayout and updatedAt from comparison so user drag/resize
          // doesn't trigger re-renders via the poll
          const parsed = JSON.parse(text);
          const { gridLayout: _gridLayout, updatedAt: _updatedAt, ...comparable } = parsed;
          const compareKey = JSON.stringify(comparable);
          if (compareKey !== lastJsonRef.current) {
            lastJsonRef.current = compareKey;
            setConfig(parsed);
          }
        }
      } catch {
        // File might not exist yet
      }
    }

    fetchConfig();

    const interval = setInterval(fetchConfig, 2000);
    return () => clearInterval(interval);
  }, []);

  return config;
}
