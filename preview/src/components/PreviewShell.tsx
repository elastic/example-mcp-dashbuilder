/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';

interface PreviewShellProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Lightweight native-style shell that wraps MCP preview content.
 * Communicates the source (Elasticsearch / Kibana) without using EUI chrome.
 *
 * DOM class names (`dash-previewPanel*`) are set on every element so callers
 * can target them via CSS or verify their presence in the rendered DOM.
 * Inline styles are kept alongside the class names so the component remains
 * self-contained without a separate stylesheet import.
 */
export function PreviewShell({ title, children }: PreviewShellProps) {
  return (
    <div
      className="dash-previewPanel"
      style={{
        border: '1px solid var(--dash-border)',
        borderRadius: 'var(--dash-radius)',
        overflow: 'hidden',
      }}
    >
      <div
        className="dash-previewPanelHeader"
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 36,
          padding: '0 12px',
          borderBottom: '1px solid var(--dash-border)',
          borderTopLeftRadius: 'var(--dash-radius)',
          borderTopRightRadius: 'var(--dash-radius)',
          background: 'var(--dash-surface-subtle)',
        }}
      >
        <span
          className="dash-previewPanelTitle"
          style={{
            color: 'var(--dash-muted)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {title}
        </span>
      </div>
      <div
        className="dash-previewPanelBody"
        style={{
          padding: 12,
          background: 'var(--dash-bg)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
