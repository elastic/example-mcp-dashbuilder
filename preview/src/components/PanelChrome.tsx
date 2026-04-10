/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { EuiProgress } from '@elastic/eui';

interface PanelChromeProps {
  title: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function PanelChrome({ title, isLoading, children }: PanelChromeProps) {
  return (
    <div style={containerStyle}>
      {isLoading && <EuiProgress size="xs" color="accent" position="absolute" />}
      <div style={headerStyle}>
        <span style={titleStyle}>{title}</span>
      </div>
      <div style={contentStyle}>{children}</div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  border: '1px solid #D3DAE6',
  borderRadius: 6,
  background: '#fff',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderBottom: '1px solid #EEF0F4',
  minHeight: 32,
  display: 'flex',
  alignItems: 'center',
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#343741',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const contentStyle: React.CSSProperties = {
  flex: 1,
  padding: 8,
  minHeight: 0,
};
