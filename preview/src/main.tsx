/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { EuiProvider } from '@elastic/eui';
import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import { App } from './App';
import { ChartPreview } from './components/ChartPreview';
import { McpAppProvider } from './context/McpAppContext';
import type { DashboardConfig, PanelConfig } from './types';

import '@elastic/charts/dist/theme_light.css';

// Pre-cache icons used by kbn-grid-layout and EuiSuperDatePicker
import { appendIconComponentCache } from '@elastic/eui/es/components/icon/icon';
import { icon as arrowDown } from '@elastic/eui/es/components/icon/assets/arrow_down';
import { icon as arrowLeft } from '@elastic/eui/es/components/icon/assets/arrow_left';
import { icon as arrowRight } from '@elastic/eui/es/components/icon/assets/arrow_right';
import { icon as arrowUp } from '@elastic/eui/es/components/icon/assets/arrow_up';
import { icon as calendar } from '@elastic/eui/es/components/icon/assets/calendar';
import { icon as chevronSingleDown } from '@elastic/eui/es/components/icon/assets/chevron_single_down';
import { icon as chevronSingleRight } from '@elastic/eui/es/components/icon/assets/chevron_single_right';
import { icon as clock } from '@elastic/eui/es/components/icon/assets/clock';
import { icon as cross } from '@elastic/eui/es/components/icon/assets/cross';
import { icon as grab } from '@elastic/eui/es/components/icon/assets/grab';
import { icon as grabOmnidirectional } from '@elastic/eui/es/components/icon/assets/grab_omnidirectional';
import { icon as move } from '@elastic/eui/es/components/icon/assets/move';
import { icon as pencil } from '@elastic/eui/es/components/icon/assets/pencil';
import { icon as plus } from '@elastic/eui/es/components/icon/assets/plus';
import { icon as popout } from '@elastic/eui/es/components/icon/assets/popout';
import { icon as refresh } from '@elastic/eui/es/components/icon/assets/refresh';
import { icon as trash } from '@elastic/eui/es/components/icon/assets/trash';
import { icon as warning } from '@elastic/eui/es/components/icon/assets/warning';

appendIconComponentCache({
  arrowDown,
  arrowLeft,
  arrowRight,
  arrowUp,
  calendar,
  chevronSingleDown,
  chevronSingleRight,
  clock,
  cross,
  grab,
  grabOmnidirectional,
  move,
  pencil,
  plus,
  popout,
  refresh,
  trash,
  warning,
});

// ── Helpers ───────────────────────────────────────────────────────────────

/** Parse JSON from the first text content block of a tool result. */
function parseToolResult(result: { content?: Array<{ type: string; text?: string }> }): unknown {
  const text = result.content?.find((c: { type: string }) => c.type === 'text') as
    | { text?: string }
    | undefined;
  if (!text?.text) return null;
  try {
    return JSON.parse(text.text);
  } catch {
    return null;
  }
}

// ── MCP App bootstrap ─────────────────────────────────────────────────────

/** Tools that show a single chart preview instead of the full dashboard. */
const CHART_PREVIEW_TOOLS = new Set(['create_chart', 'create_metric', 'create_heatmap']);

interface ChartPreviewData {
  chart: PanelConfig;
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
}

type ViewMode = 'dashboard' | 'chart-preview';

function Root() {
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [chartPreview, setChartPreview] = useState<ChartPreviewData | null>(null);
  const [mcpApp] = useState(
    () => new McpApp({ name: 'example-mcp-dashbuilder', version: '0.1.0' })
  );

  // Store the tool input so we can extract the chart ID for preview lookup.
  // ontoolinput fires before ontoolresult with the tool call arguments.
  const toolInputRef = React.useRef<Record<string, unknown> | undefined>();

  useEffect(() => {
    mcpApp.ontoolinput = (params: { arguments?: Record<string, unknown> }) => {
      toolInputRef.current = params.arguments;
    };

    mcpApp.ontoolresult = () => {
      // Use toolInfo from the host context to determine which tool spawned
      // this iframe, so each inline preview keeps the correct mode even
      // when the user scrolls back to it later.
      const toolName = mcpApp.getHostContext()?.toolInfo?.tool?.name;
      const isChartPreview = toolName != null && CHART_PREVIEW_TOOLS.has(toolName);

      if (isChartPreview) {
        // Pass the chart ID from the tool arguments so the server returns
        // this specific chart's preview, not just the most recent one.
        const chartId = toolInputRef.current?.id as string | undefined;
        mcpApp
          .callServerTool({
            name: 'app_only_get_chart_preview',
            arguments: chartId ? { chartId } : {},
          })
          .then((r) => {
            const data = parseToolResult(r) as ChartPreviewData | null;
            if (data?.chart) {
              setChartPreview(data);
              setViewMode('chart-preview');
            }
          });
      } else {
        mcpApp
          .callServerTool({ name: 'app_only_get_dashboard_config', arguments: {} })
          .then((r) => {
            const data = parseToolResult(r) as DashboardConfig | null;
            if (data) {
              setDashboard(data);
              setViewMode('dashboard');
            }
          });
      }
    };

    // Clean up on teardown
    mcpApp.onteardown = async () => {
      return {};
    };

    // Connect to host
    mcpApp.connect();
  }, [mcpApp]);

  // Enforce light theme for now
  // TODO set up proper dark/light theme support for charts and EUI components
  return (
    <EuiProvider colorMode="light">
      <RootContent
        viewMode={viewMode}
        chartPreview={chartPreview}
        dashboard={dashboard}
        mcpApp={mcpApp}
      />
    </EuiProvider>
  );
}

function RootContent({
  viewMode,
  chartPreview,
  dashboard,
  mcpApp,
}: {
  viewMode: ViewMode | null;
  chartPreview: ChartPreviewData | null;
  dashboard: DashboardConfig | null;
  mcpApp: McpApp;
}) {
  if (viewMode === 'chart-preview' && chartPreview) {
    return <ChartPreview preview={{ mode: 'chart-preview', ...chartPreview }} />;
  }

  if (viewMode === 'dashboard' && dashboard) {
    return (
      <McpAppProvider app={mcpApp}>
        <App initialDashboard={dashboard} />
      </McpAppProvider>
    );
  }

  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
      {viewMode ? 'Loading…' : 'Waiting for data…'}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
