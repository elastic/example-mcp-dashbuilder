import React from 'react';

interface PanelChromeProps {
  title: string;
  children: React.ReactNode;
}

export function PanelChrome({ title, children }: PanelChromeProps) {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>{title}</span>
      </div>
      <div style={contentStyle}>{children}</div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
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
