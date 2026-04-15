/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, expect, it, vi } from 'vitest';
import type { McpUiStyles } from '@modelcontextprotocol/ext-apps';

vi.mock('@modelcontextprotocol/ext-apps', () => ({
  applyHostStyleVariables: vi.fn((styles: Record<string, string>, root: HTMLElement) => {
    for (const [key, value] of Object.entries(styles)) {
      root.style.setProperty(key, value);
    }
  }),
}));

import {
  clearHostStyleVariables,
  mergeHostThemeContext,
  resolveHostTheme,
  syncHostStyleVariables,
} from './host_theme';

describe('host theme adapter', () => {
  it('keeps the legacy fallback when host theme is absent', () => {
    expect(resolveHostTheme(undefined)).toEqual({
      colorMode: 'dark',
      hasActiveStyles: false,
      useNeutralDarkFallback: true,
    });
  });

  it('uses the host light or dark preference when provided', () => {
    expect(resolveHostTheme({ theme: 'light' })).toEqual({
      colorMode: 'light',
      hasActiveStyles: false,
      useNeutralDarkFallback: false,
    });
  });

  it('keeps the neutral dark fallback when host only sends non-color variables', () => {
    expect(
      resolveHostTheme({
        theme: 'dark',
        styles: {
          variables: {
            '--font-sans': 'Host Sans, sans-serif',
          } as McpUiStyles,
        },
      })
    ).toEqual({
      colorMode: 'dark',
      hasActiveStyles: false,
      useNeutralDarkFallback: true,
    });
  });

  it('prefers host styling when active variables are present', () => {
    expect(
      resolveHostTheme({
        theme: 'dark',
        styles: {
          variables: {
            '--color-background-primary': '#101214',
          } as McpUiStyles,
        },
      })
    ).toEqual({
      colorMode: 'dark',
      hasActiveStyles: true,
      useNeutralDarkFallback: false,
    });
  });

  it('preserves existing host styles across partial context updates', () => {
    const merged = mergeHostThemeContext(
      {
        theme: 'dark',
        styles: {
          variables: {
            '--color-background-primary': '#101214',
          } as McpUiStyles,
        },
      },
      { theme: 'light' }
    );

    expect(merged).toEqual({
      theme: 'light',
      styles: {
        variables: {
          '--color-background-primary': '#101214',
        },
      },
    });
  });

  it('merges partial style variable updates without dropping existing keys', () => {
    const merged = mergeHostThemeContext(
      {
        theme: 'dark',
        styles: {
          variables: {
            '--color-background-primary': '#101214',
            '--font-sans': 'Host Sans, sans-serif',
          } as McpUiStyles,
        },
      },
      {
        styles: {
          variables: {
            '--color-text-primary': '#f6f8fc',
          } as McpUiStyles,
        },
      }
    );

    expect(merged).toEqual({
      theme: 'dark',
      styles: {
        variables: {
          '--color-background-primary': '#101214',
          '--font-sans': 'Host Sans, sans-serif',
          '--color-text-primary': '#f6f8fc',
        },
      },
    });
  });

  it('allows the host to explicitly clear styles', () => {
    const merged = mergeHostThemeContext(
      {
        theme: 'dark',
        styles: {
          variables: {
            '--color-background-primary': '#101214',
          } as McpUiStyles,
        },
      },
      { styles: undefined }
    );

    expect(merged).toEqual({
      theme: 'dark',
      styles: undefined,
    });
  });

  it('clears stale host variables when the merged style set removes keys', () => {
    const root = document.createElement('div');

    const firstApplied = syncHostStyleVariables(
      root,
      {
        '--color-background-primary': '#ffffff',
        '--font-sans': 'Host Sans, sans-serif',
      } as McpUiStyles,
      new Set()
    );

    expect(root.style.getPropertyValue('--color-background-primary')).toBe('#ffffff');
    expect(root.style.getPropertyValue('--font-sans')).toBe('Host Sans, sans-serif');

    const secondApplied = syncHostStyleVariables(
      root,
      {
        '--color-text-primary': '#111111',
      } as McpUiStyles,
      firstApplied
    );

    expect(secondApplied).toEqual(new Set(['--color-text-primary']));
    expect(root.style.getPropertyValue('--color-background-primary')).toBe('');
    expect(root.style.getPropertyValue('--font-sans')).toBe('');
    expect(root.style.getPropertyValue('--color-text-primary')).toBe('#111111');
  });

  it('removes all applied host variables when clearing the theme', () => {
    const root = document.createElement('div');
    root.style.setProperty('--color-text-primary', '#222222');
    root.style.setProperty('--font-sans', 'Host Sans, sans-serif');

    clearHostStyleVariables(root, new Set(['--color-text-primary', '--font-sans']));

    expect(root.style.getPropertyValue('--color-text-primary')).toBe('');
    expect(root.style.getPropertyValue('--font-sans')).toBe('');
  });
});
