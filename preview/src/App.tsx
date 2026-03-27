import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EuiSuperDatePicker, EuiFlexGroup, EuiFlexItem, EuiButtonEmpty } from '@elastic/eui';
interface DurationRange {
  end: string;
  label?: string;
  start: string;
}

interface OnTimeChangeProps extends DurationRange {
  isInvalid: boolean;
  isQuickSelection: boolean;
}

const ALL_DATA_SENTINEL = '__all_data__';

const COMMONLY_USED_RANGES: DurationRange[] = [
  { start: ALL_DATA_SENTINEL, end: 'now', label: 'All data' },
  { start: 'now-15m', end: 'now', label: 'Last 15 minutes' },
  { start: 'now-1h', end: 'now', label: 'Last 1 hour' },
  { start: 'now-24h', end: 'now', label: 'Last 24 hours' },
  { start: 'now-7d', end: 'now', label: 'Last 7 days' },
  { start: 'now-30d', end: 'now', label: 'Last 30 days' },
  { start: 'now-1y', end: 'now', label: 'Last 1 year' },
];
import { GridLayout } from './grid-layout';
import type { GridLayoutData, GridSettings } from './grid-layout';
import type { GridPanelData } from './grid-layout';
import { PanelChrome } from './components/PanelChrome';
import { ChartPanel } from './components/ChartPanel';
import { useDashboardConfig } from './hooks/useDashboardConfig';
import type { PanelConfig, SectionConfig } from './hooks/useDashboardConfig';

const GRID_SETTINGS: GridSettings = {
  gutterSize: 8,
  rowHeight: 20,
  columnCount: 48,
  keyboardDragTopLimit: 0,
};

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  bar: { w: 24, h: 15 },
  line: { w: 24, h: 15 },
  area: { w: 24, h: 15 },
  pie: { w: 24, h: 15 },
  metric: { w: 12, h: 10 },
  heatmap: { w: 24, h: 15 },
};

function autoPlacePanels(
  charts: PanelConfig[],
  startRow: number = 0,
  columnCount: number = GRID_SETTINGS.columnCount
): { panels: Record<string, GridPanelData>; nextRow: number } {
  const panels: Record<string, GridPanelData> = {};
  let nextRow = startRow;
  let colOffset = 0;
  let maxHeightInRow = 0;

  for (const chart of charts) {
    const size = DEFAULT_SIZES[chart.chartType] || { w: 24, h: 15 };
    if (colOffset + size.w > columnCount) {
      nextRow += maxHeightInRow;
      colOffset = 0;
      maxHeightInRow = 0;
    }
    panels[chart.id] = {
      id: chart.id,
      column: colOffset,
      row: nextRow - startRow,
      width: size.w,
      height: size.h,
    };
    colOffset += size.w;
    maxHeightInRow = Math.max(maxHeightInRow, size.h);
    if (colOffset >= columnCount) {
      nextRow += maxHeightInRow;
      colOffset = 0;
      maxHeightInRow = 0;
    }
  }
  if (colOffset > 0) {
    nextRow += maxHeightInRow;
  }

  return { panels, nextRow };
}

function buildGridLayout(charts: PanelConfig[], sections: SectionConfig[]): GridLayoutData {
  const layout: GridLayoutData = {};
  const chartMap = new Map(charts.map((c) => [c.id, c]));

  const assignedPanelIds = new Set<string>();
  for (const section of sections) {
    for (const panelId of section.panelIds) {
      assignedPanelIds.add(panelId);
    }
  }

  const unassignedCharts = charts.filter((c) => !assignedPanelIds.has(c.id));
  const { panels: topLevelPanels, nextRow: afterTopLevel } = autoPlacePanels(unassignedCharts, 0);

  for (const [id, panel] of Object.entries(topLevelPanels)) {
    layout[id] = { ...panel, type: 'panel' as const };
  }

  let sectionRow = afterTopLevel;
  for (const section of sections) {
    const sectionCharts = section.panelIds
      .map((id) => chartMap.get(id))
      .filter((c): c is PanelConfig => c !== undefined);

    const { panels: sectionPanels } = autoPlacePanels(sectionCharts, 0);

    layout[section.id] = {
      type: 'section' as const,
      id: section.id,
      row: sectionRow,
      title: section.title,
      isCollapsed: section.collapsed,
      panels: sectionPanels,
    };

    sectionRow++;
  }

  return layout;
}

function getDashboardKey(charts: PanelConfig[], sections: SectionConfig[]): string {
  const chartsKey = charts.map((c) => `${c.id}:${c.chartType}`).join(',');
  const sectionsKey = sections.map((s) => `${s.id}:${s.panelIds.join('+')}`).join(',');
  return `${chartsKey}|${sectionsKey}`;
}

export function App() {
  const dashboard = useDashboardConfig();
  const hasCharts = dashboard.charts.length > 0;

  const [isAllData, setIsAllData] = useState(true);
  const [start, setStart] = useState('now-15m');
  const [end, setEnd] = useState('now');
  const [isLoading, setIsLoading] = useState(false);

  // Clear loading when polled data arrives
  useEffect(() => {
    if (isLoading) setIsLoading(false);
  }, [dashboard.updatedAt]);

  const requery = useCallback((s: string, e: string) => {
    const baseUrl =
      window.location.protocol === 'https:' || window.location.hostname !== 'localhost'
        ? 'http://localhost:5173'
        : '';

    setIsLoading(true);
    fetch(`${baseUrl}/api/requery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: s, end: e }),
    }).catch(() => setIsLoading(false));
  }, []);

  const onTimeChange = useCallback(
    ({ start: s, end: e }: OnTimeChangeProps) => {
      if (s === ALL_DATA_SENTINEL) {
        setIsAllData(true);
        requery('', '');
        return;
      }
      setIsAllData(false);
      setStart(s);
      setEnd(e);
      requery(s, e);
    },
    [requery]
  );

  const params = new URLSearchParams(window.location.search);
  const renderChartId = params.get('render');

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
  const currentKey = getDashboardKey(dashboard.charts, sections);

  if (currentKey !== dashboardKeyRef.current && hasCharts) {
    dashboardKeyRef.current = currentKey;
    layoutRef.current = buildGridLayout(dashboard.charts, sections);
  }

  const handleLayoutChange = useCallback((newLayout: GridLayoutData) => {
    // Persist layout changes so the export tool can read them
    fetch('/api/save-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLayout),
    }).catch(() => {});
  }, []);

  const renderPanelContents = useCallback(
    (panelId: string) => {
      const config = chartMap[panelId];
      if (!config) return <div>Panel not found</div>;
      return (
        <PanelChrome title={config.title} isLoading={isLoading}>
          <ChartPanel config={config} />
        </PanelChrome>
      );
    },
    [chartMap, isLoading]
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
    return (
      <div
        id="render-ready"
        data-status="ok"
        style={{
          width: 600,
          height: chart.chartType === 'metric' ? 200 : 350,
          padding: 16,
          background: '#fff',
        }}
      >
        <ChartPanel config={chart} />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px 24px',
        fontFamily: 'Inter, system-ui, sans-serif',
        background: '#F5F7FA',
        color: '#343741',
        minHeight: '100vh',
      }}
    >
      <header style={{ marginBottom: 16 }}>
        <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" responsive={false}>
          <EuiFlexItem grow={false}>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#1A1C21' }}>
              {dashboard.title}
            </h1>
            {hasCharts && (
              <p style={{ color: '#666', marginTop: 4, fontSize: 14 }}>
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
                isLoading={isLoading}
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
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#666' }}>
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
