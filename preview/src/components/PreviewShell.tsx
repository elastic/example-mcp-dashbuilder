/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';

function ElasticLogo() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 280 280"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, marginRight: 2, color: 'var(--dash-muted)' }}
    >
      <path
        d="M220 143.494C220.014 137.002 218.02 130.664 214.291 125.348C210.563 120.033 205.282 116 199.173 113.802C199.731 110.97 200.012 108.09 200.014 105.204C200.016 95.6466 196.989 86.3345 191.367 78.606C185.744 70.8774 177.816 65.1304 168.723 62.1908C159.629 59.2511 149.837 59.2703 140.754 62.2456C131.672 65.2208 123.767 70.9989 118.175 78.7495C114.051 75.5553 108.999 73.7919 103.783 73.7264C98.5669 73.6609 93.4719 75.2968 89.2691 78.3864C85.0664 81.4761 81.985 85.8511 80.4915 90.849C78.998 95.8468 79.1738 101.195 80.9924 106.084C74.8667 108.313 69.571 112.365 65.8179 117.695C62.0647 123.025 60.0344 129.376 60.0002 135.894C59.9796 142.413 61.9805 148.778 65.7273 154.113C69.4741 159.447 74.7825 163.489 80.9216 165.681C80.3896 168.514 80.1264 171.39 80.1357 174.271C80.1186 183.826 83.1389 193.139 88.7603 200.866C94.3818 208.592 102.313 214.331 111.41 217.255C120.506 220.179 130.297 220.137 139.367 217.133C148.438 214.129 156.319 208.32 161.873 200.545C165.984 203.753 171.03 205.533 176.245 205.613C181.46 205.693 186.558 204.07 190.767 200.989C194.975 197.909 198.064 193.54 199.564 188.545C201.064 183.55 200.894 178.202 199.078 173.313C205.192 171.072 210.474 167.013 214.213 161.683C217.953 156.353 219.973 150.006 220 143.494ZM121.947 83.5751C127.099 76.0815 134.679 70.5951 143.407 68.042C152.135 65.4889 161.477 66.0254 169.855 69.5611C178.233 73.0968 185.135 79.415 189.395 87.4492C193.656 95.4834 195.013 104.741 193.239 113.661L157.919 144.595L122.906 128.64L116.068 114.046L121.947 83.5751ZM104.24 79.6454C108.392 79.6446 112.43 81.0088 115.731 83.5279L110.433 110.792L86.4467 105.125C85.4065 102.261 85.0707 99.1883 85.4677 96.1668C85.8647 93.1453 86.9827 90.2637 88.7275 87.7652C90.4723 85.2667 92.7926 83.2247 95.4925 81.8114C98.1925 80.3982 101.193 79.6553 104.24 79.6454ZM66.1854 135.965C66.2207 130.403 67.9912 124.99 71.2499 120.481C74.5086 115.973 79.0931 112.594 84.364 110.815L110.693 117.032L116.87 130.244L83.2087 160.691C78.2002 158.779 73.8904 155.392 70.8504 150.976C67.8104 146.561 66.1836 141.326 66.1854 135.965ZM158.21 195.845C153.454 202.848 146.577 208.14 138.591 210.946C130.604 213.751 121.928 213.921 113.838 211.432C105.747 208.942 98.6681 203.924 93.6404 197.114C88.6127 190.303 85.9013 182.061 85.9044 173.596C85.9081 170.956 86.1714 168.324 86.6904 165.736L121.114 134.582L156.261 150.599L164.042 165.469L158.21 195.845ZM175.799 199.775C171.659 199.761 167.639 198.379 164.364 195.845L169.582 168.668L193.553 174.271C194.596 177.133 194.935 180.204 194.541 183.224C194.148 186.244 193.034 189.125 191.293 191.624C189.552 194.124 187.236 196.167 184.539 197.583C181.843 198.999 178.845 199.745 175.799 199.759V199.775ZM195.636 168.566L169.245 162.396L162.234 149.035L196.752 118.793C201.765 120.688 206.082 124.064 209.13 128.472C212.178 132.88 213.812 138.112 213.815 143.471C213.765 149.021 211.987 154.419 208.73 158.913C205.472 163.407 200.896 166.776 195.636 168.55V168.566Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
        borderRadius: 6,
        background: 'var(--dash-surface-subtle)',
      }}
    >
      <div
        className="dash-previewPanelHeader"
        style={{
          display: 'flex',
          alignItems: 'center',
          minHeight: 36,
          padding: '0 8px',
          borderBottom: '1px solid var(--dash-border)',
        }}
      >
        <ElasticLogo />
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
