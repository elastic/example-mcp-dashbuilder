import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { EuiProvider } from '@elastic/eui';
import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
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
  const [mcpApp] = useState(() => new McpApp({ name: 'elastic-dashbuilder', version: '0.1.0' }));
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // On tool result, try chart preview first; fall back to dashboard view.
    // The server sets chart preview data when create_chart/metric/heatmap runs,
    // so its presence tells us which mode to render.
    mcpApp.ontoolresult = () => {
      mcpApp
        .callServerTool({ name: 'app_only_get_chart_preview', arguments: {} })
        .then((r) => {
          if (r.isError) {
            // No chart preview — render full dashboard
            setViewMode('dashboard');
            return mcpApp.callServerTool({ name: 'app_only_get_dashboard_config', arguments: {} });
          }
          const data = parseToolResult(r) as ChartPreviewData | null;
          if (data?.chart) {
            setChartPreview(data);
            setViewMode('chart-preview');
          } else {
            setViewMode('dashboard');
            return mcpApp.callServerTool({ name: 'app_only_get_dashboard_config', arguments: {} });
          }
          return undefined;
        })
        .then((r) => {
          if (r) {
            const data = parseToolResult(r) as DashboardConfig | null;
            if (data) setDashboard(data);
          }
        });
    };

    // Adapt to host theme changes
    mcpApp.onhostcontextchanged = (ctx: McpUiHostContext) => {
      if (ctx.theme) {
        setColorMode(ctx.theme === 'dark' ? 'dark' : 'light');
      }
    };

    // Clean up on teardown
    mcpApp.onteardown = async () => {
      return {};
    };

    // Connect to host
    mcpApp.connect().then(() => {
      const ctx = mcpApp.getHostContext();
      if (ctx?.theme) {
        setColorMode(ctx.theme === 'dark' ? 'dark' : 'light');
      }
    });
  }, [mcpApp]);

  return (
    <EuiProvider colorMode={colorMode}>
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
