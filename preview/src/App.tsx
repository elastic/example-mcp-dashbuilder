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
import { ChartPanel } from './components/ChartPanel';
import type { PanelConfig, SectionConfig, DashboardConfig } from './types';
import type { DurationRange } from './constants';
import { ALL_DATA_SENTINEL, COMMONLY_USED_RANGES, GRID_SETTINGS } from './constants';
import { TimeRangeProvider, useTimeRange } from './context/TimeRangeContext';
import { useMcpApp } from './context/McpAppContext';
import { useEsqlQuery } from './hooks/useEsqlQuery';
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

  const renderChartId = new URLSearchParams(window.location.search).get('render');

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

  if (renderChartId) {
    const chart = dashboard.charts.find((c) => c.id === renderChartId);
    if (!chart) {
      return (
        <div id="render-ready" data-status="not-found">
          Chart not found
        </div>
      );
    }
    return <RenderSingleChart config={chart} />;
  }

  const appStyle: React.CSSProperties = {
    padding: `${euiTheme.size.l} ${euiTheme.size.xl}`,
    fontFamily: 'Inter, system-ui, sans-serif',
    background: 'var(--euiPageBackgroundColor, #101418)',
    color: 'var(--euiTextColor, #F5F7FA)',
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

function RenderSingleChart({ config }: { config: PanelConfig }) {
  const { timeRange } = useTimeRange();
  const { euiTheme } = useEuiTheme();
  const { data, isLoading } = useEsqlQuery(config.esqlQuery, timeRange, config.timeField);

  // Fetch trend data for metrics (same logic as DashboardPanel)
  const trendQuery = config.chartType === 'metric' ? config.trendEsqlQuery : undefined;
  const { data: trendData, isLoading: trendLoading } = useEsqlQuery(
    trendQuery,
    timeRange,
    config.timeField
  );

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

  const ready = !isLoading && !trendLoading;

  return (
    <div
      id="render-ready"
      data-status={ready ? 'ok' : 'loading'}
      style={{
        width: 600,
        height: config.chartType === 'metric' ? 200 : 350,
        padding: Number.parseInt(euiTheme.size.l, 10) || 16,
        background: 'var(--euiColorEmptyShade, #1D1E24)',
        color: 'var(--euiTextColor, #F5F7FA)',
      }}
    >
      <ChartPanel config={liveConfig} />
    </div>
  );
}
