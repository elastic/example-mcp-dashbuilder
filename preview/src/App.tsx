/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  EuiSuperDatePicker,
  EuiFlexGroup,
  EuiFlexItem,
  EuiButtonEmpty,
  useEuiTheme,
} from '@elastic/eui';
import { GridLayout } from './grid-layout';
import type { GridLayoutData } from './grid-layout';
import type { GridPanelData } from './grid-layout';
import { DashboardPanel } from './components/DashboardPanel';
import type { PanelConfig, SectionConfig, DashboardConfig } from './types';
import type { DurationRange } from './constants';
import { ALL_DATA_SENTINEL, COMMONLY_USED_RANGES, GRID_SETTINGS } from './constants';
import { TimeRangeProvider, useTimeRange } from './context/TimeRangeContext';
import { useMcpApp } from './context/McpAppContext';
import { buildAutoGridLayout } from './utils/auto_layout';

interface OnTimeChangeProps extends DurationRange {
  isInvalid: boolean;
  isQuickSelection: boolean;
}

function buildGridLayout(
  charts: PanelConfig[],
  sections: SectionConfig[],
  persistedLayout?: GridLayoutData
): GridLayoutData {
  const autoLayout = buildAutoGridLayout(charts, sections);
  if (!persistedLayout || Object.keys(persistedLayout).length === 0) {
    return autoLayout;
  }

  const mergedLayout: GridLayoutData = {};
  for (const [widgetId, autoWidget] of Object.entries(autoLayout)) {
    const persistedWidget = persistedLayout[widgetId];
    if (!persistedWidget || persistedWidget.type !== autoWidget.type) {
      mergedLayout[widgetId] = autoWidget;
      continue;
    }

    if (autoWidget.type === 'panel') {
      mergedLayout[widgetId] = {
        ...autoWidget,
        ...persistedWidget,
        type: 'panel',
      };
      continue;
    }

    const persistedSection = persistedWidget.type === 'section' ? persistedWidget : undefined;
    const mergedPanels: Record<string, GridPanelData> = {};
    for (const [panelId, autoPanel] of Object.entries(autoWidget.panels)) {
      const persistedPanel = persistedSection?.panels[panelId];
      mergedPanels[panelId] = persistedPanel ? { ...autoPanel, ...persistedPanel } : autoPanel;
    }

    mergedLayout[widgetId] = {
      ...autoWidget,
      ...persistedSection,
      type: 'section',
      panels: mergedPanels,
    };
  }

  return mergedLayout;
}

function getDashboardKey(
  charts: PanelConfig[],
  sections: SectionConfig[],
  gridLayout?: GridLayoutData
): string {
  const chartsKey = charts.map((c) => `${c.id}:${c.chartType}`).join(',');
  const sectionsKey = sections.map((s) => `${s.id}:${s.panelIds.join('+')}`).join(',');
  const layoutKey = JSON.stringify(gridLayout || {});
  return `${chartsKey}|${sectionsKey}|${layoutKey}`;
}

export function App({ initialDashboard }: { initialDashboard: DashboardConfig }) {
  return (
    <TimeRangeProvider>
      <AppInner initialDashboard={initialDashboard} />
    </TimeRangeProvider>
  );
}

function AppInner({ initialDashboard }: { initialDashboard: DashboardConfig }) {
  const dashboard = initialDashboard;
  const hasCharts = dashboard.charts.length > 0;
  const { setTimeRange } = useTimeRange();
  const mcpApp = useMcpApp();
  const { euiTheme } = useEuiTheme();

  const [isAllData, setIsAllData] = useState(true);
  const [start, setStart] = useState('now-15m');
  const [end, setEnd] = useState('now');

  const onTimeChange = useCallback(
    ({ start: s, end: e }: OnTimeChangeProps) => {
      if (s === ALL_DATA_SENTINEL) {
        setIsAllData(true);
        setTimeRange(null);
        return;
      }
      setIsAllData(false);
      setStart(s);
      setEnd(e);
      setTimeRange({ start: s, end: e });
    },
    [setTimeRange]
  );

  const chartMap = useMemo(() => {
    const map: Record<string, PanelConfig> = {};
    for (const chart of dashboard.charts) {
      map[chart.id] = chart;
    }
    return map;
  }, [dashboard.charts]);

  const layoutRef = useRef<GridLayoutData | null>(null);
  const dashboardKeyRef = useRef<string>('');
  const sections = dashboard.sections || [];
  const currentKey = getDashboardKey(dashboard.charts, sections, dashboard.gridLayout);

  if (currentKey !== dashboardKeyRef.current && hasCharts) {
    dashboardKeyRef.current = currentKey;
    layoutRef.current = buildGridLayout(dashboard.charts, sections, dashboard.gridLayout);
  }

  const handleLayoutChange = useCallback(
    (newLayout: GridLayoutData) => {
      mcpApp
        .callServerTool({
          name: 'app_only_save_panel_layout',
          arguments: { layout: newLayout },
        })
        .catch((err: unknown) => console.error('[save-layout]', err));
    },
    [mcpApp]
  );

  const renderPanelContents = useCallback(
    (panelId: string) => {
      const config = chartMap[panelId];
      if (!config) return <div>Panel not found</div>;
      return <DashboardPanel config={config} />;
    },
    [chartMap]
  );

  const appStyle: React.CSSProperties = {
    padding: `${euiTheme.size.l} ${euiTheme.size.xl}`,
    fontFamily: 'Inter, system-ui, sans-serif',
    background: euiTheme.colors.body,
    color: euiTheme.colors.text,
    minHeight: '100vh',
  };
  const subduedTextStyle: React.CSSProperties = {
    marginTop: euiTheme.size.xs,
    fontSize: 14,
    opacity: 0.72,
  };
  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: `${euiTheme.size.xxl} ${euiTheme.size.l}`,
    opacity: 0.8,
  };
  return (
    <div style={appStyle}>
      <header style={{ marginBottom: 16 }}>
        <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" responsive={false}>
          <EuiFlexItem grow={false}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{dashboard.title}</h1>
            {hasCharts && (
              <p style={subduedTextStyle}>
                {dashboard.charts.length} chart(s)
                {sections.length > 0 && ` · ${sections.length} section(s)`}
              </p>
            )}
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            {isAllData ? (
              <EuiButtonEmpty iconType="calendar" onClick={() => setIsAllData(false)}>
                All data
              </EuiButtonEmpty>
            ) : (
              <EuiSuperDatePicker
                start={start}
                end={end}
                onTimeChange={onTimeChange}
                commonlyUsedRanges={COMMONLY_USED_RANGES}
                showUpdateButton={false}
                showTimeWindowButtons={true}
              />
            )}
          </EuiFlexItem>
        </EuiFlexGroup>
      </header>

      {hasCharts && layoutRef.current ? (
        <GridLayout
          layout={layoutRef.current}
          gridSettings={GRID_SETTINGS}
          renderPanelContents={renderPanelContents}
          onLayoutChange={handleLayoutChange}
          accessMode={'EDIT'}
        />
      ) : (
        <div style={emptyStateStyle}>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>No charts yet</h2>
          <p>
            Use the MCP tools in Cursor to create charts. Try asking:
            <br />
            <em>
              "Create a bar chart showing revenue by product category from the ecommerce sample
              data"
            </em>
          </p>
        </div>
      )}
    </div>
  );
}
