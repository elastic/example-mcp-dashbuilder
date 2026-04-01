import { useState, useEffect, useRef } from 'react';
import { BASE_URL } from '../utils/base-url';
import type { DashboardConfig } from '../types';

export type { PanelConfig, SectionConfig, DashboardConfig } from '../types';

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
        const res = await fetch(`${BASE_URL}/dashboard.json?t=${Date.now()}`);
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
