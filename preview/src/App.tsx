/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { EuiSuperDatePicker, EuiFlexGroup, EuiFlexItem, EuiButtonEmpty } from '@elastic/eui';
import { GridLayout } from './grid-layout';
import type { GridLayoutData } from './grid-layout';
import type { GridPanelData } from './grid-layout';
import { DashboardPanel } from './components/DashboardPanel';
import type { PanelConfig, SectionConfig, DashboardConfig } from './types';
import type { DurationRange } from './constants';
import { ALL_DATA_SENTINEL, COMMONLY_USED_RANGES, GRID_SETTINGS, DEFAULT_SIZES } from './constants';
import { TimeRangeProvider, useTimeRange } from './context/TimeRangeContext';
import { useMcpApp } from './context/McpAppContext';

interface OnTimeChangeProps extends DurationRange {
  isInvalid: boolean;
  isQuickSelection: boolean;
}

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
    const size = DEFAULT_SIZES[chart.chartType] || DEFAULT_SIZES.bar;
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
  const currentKey = getDashboardKey(dashboard.charts, sections);

  if (currentKey !== dashboardKeyRef.current && hasCharts) {
    dashboardKeyRef.current = currentKey;
    layoutRef.current = buildGridLayout(dashboard.charts, sections);
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
