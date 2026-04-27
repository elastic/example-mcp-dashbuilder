/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { useMemo } from 'react';

interface PanelChromeProps {
  title: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function PanelChrome({ title, isLoading, children }: PanelChromeProps) {
  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--dash-surface)',
      border: '1px solid var(--dash-border)',
      borderRadius: 4,
    }),
    []
  );

  const loaderStyle = useMemo<React.CSSProperties>(
    () => ({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      background: 'var(--dash-control-focus)',
      opacity: isLoading ? 1 : 0,
      transition: 'opacity 0.2s',
    }),
    [isLoading]
  );

  const headerStyle = useMemo<React.CSSProperties>(
    () => ({
      padding: '4px 12px',
      borderBottom: '1px solid var(--dash-border)',
      minHeight: 32,
      display: 'flex',
      alignItems: 'center',
    }),
    []
  );

  const titleStyle = useMemo<React.CSSProperties>(
    () => ({
      margin: 0,
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--dash-fg)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    []
  );

  const contentStyle = useMemo<React.CSSProperties>(
    () => ({
      flex: 1,
      padding: 8,
      minHeight: 0,
      fontFamily: "'Elastic UI Numeric', Inter, sans-serif",
    }),
    []
  );

  return (
    <div style={containerStyle}>
      <div style={loaderStyle} />
      <div style={headerStyle}>
        <h3 style={titleStyle}>{title}</h3>
      </div>
      <div style={contentStyle}>{children}</div>
    </div>
  );
}
