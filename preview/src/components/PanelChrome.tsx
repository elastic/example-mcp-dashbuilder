import React, { useMemo } from 'react';
import { EuiPanel, EuiProgress, EuiTitle, useEuiTheme } from '@elastic/eui';

interface PanelChromeProps {
  title: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function PanelChrome({ title, isLoading, children }: PanelChromeProps) {
  const { euiTheme } = useEuiTheme();
  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }),
    []
  );
  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: `${euiTheme.size.xs} ${euiTheme.size.m}`,
      borderBottom: `1px solid ${euiTheme.border.color}`,
      minHeight: 32,
      display: 'flex',
      alignItems: 'center',
    }),
    [euiTheme.border.color, euiTheme.size.m, euiTheme.size.xs]
  );
  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    []
  );
  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
      padding: Number.parseInt(euiTheme.size.s, 10) || 8,
      minHeight: 0,
    }),
    [euiTheme.size.s]
  );

  return (
    <EuiPanel hasBorder hasShadow={false} paddingSize="none" style={containerStyle}>
      {isLoading && <EuiProgress size="xs" color="accent" position="absolute" />}
      <div style={headerStyle}>
        <EuiTitle size="xxxs">
          <h3 style={titleStyle}>{title}</h3>
        </EuiTitle>
      </div>
      <div style={contentStyle}>{children}</div>
    </EuiPanel>
  );
}
