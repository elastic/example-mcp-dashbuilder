import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { EuiProvider } from '@elastic/eui';
import { App as McpApp } from '@modelcontextprotocol/ext-apps';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { App } from './App';
import { McpAppProvider } from './context/McpAppContext';
import type { DashboardConfig } from './types';

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

// ── MCP App bootstrap ─────────────────────────────────────────────────────

function Root() {
  const [dashboard, setDashboard] = useState<DashboardConfig | null>(null);
  const [mcpApp] = useState(() => new McpApp({ name: 'elastic-dashbuilder', version: '0.1.0' }));
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Receive initial dashboard config from view_dashboard tool result
    mcpApp.ontoolresult = (result) => {
      if (result.structuredContent) {
        setDashboard(result.structuredContent as unknown as DashboardConfig);
      }
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

  if (!dashboard) {
    return (
      <EuiProvider colorMode={colorMode}>
        <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
          Waiting for dashboard data…
        </div>
      </EuiProvider>
    );
  }

  return (
    <EuiProvider colorMode={colorMode}>
      <McpAppProvider app={mcpApp}>
        <App initialDashboard={dashboard} />
      </McpAppProvider>
    </EuiProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
