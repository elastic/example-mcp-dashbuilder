/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import {
  applyHostStyleVariables,
  type McpUiHostContext,
  type McpUiStyles,
} from '@modelcontextprotocol/ext-apps';

export type AppColorMode = 'light' | 'dark';
export type HostThemeContext = Pick<McpUiHostContext, 'styles' | 'theme'>;

export interface ResolvedHostTheme {
  colorMode: AppColorMode;
  hasActiveStyles: boolean;
  useNeutralDarkFallback: boolean;
}

function getActiveHostStyleVariables(variables?: McpUiStyles): McpUiStyles | undefined {
  if (!variables) return undefined;

  const activeEntries = Object.entries(variables).filter(
    ([, value]) => typeof value === 'string' && value.trim().length > 0
  );

  if (activeEntries.length === 0) return undefined;
  return Object.fromEntries(activeEntries) as McpUiStyles;
}

function hasActiveHostColorVariables(variables?: McpUiStyles): boolean {
  const activeVariables = getActiveHostStyleVariables(variables);
  if (!activeVariables) return false;
  return Object.keys(activeVariables).some((key) => key.startsWith('--color-'));
}

export function resolveHostTheme(
  context?: HostThemeContext,
  fallbackColorMode: AppColorMode = 'dark'
): ResolvedHostTheme {
  const hasActiveStyles = hasActiveHostColorVariables(context?.styles?.variables);
  const colorMode =
    context?.theme === 'light' || context?.theme === 'dark' ? context.theme : fallbackColorMode;

  return {
    colorMode,
    hasActiveStyles,
    useNeutralDarkFallback: !hasActiveStyles && colorMode === 'dark',
  };
}

function mergeHostStyleVariables(
  previous: McpUiStyles | undefined,
  update: McpUiStyles | undefined
): McpUiStyles | undefined {
  if (update === undefined) return previous;
  return { ...previous, ...update } as McpUiStyles;
}

function mergeHostStyles(
  previous: HostThemeContext['styles'],
  update: HostThemeContext['styles']
): HostThemeContext['styles'] {
  if (update === undefined) return undefined;
  return {
    ...previous,
    ...update,
    variables: mergeHostStyleVariables(previous?.variables, update.variables),
    css: update.css ?? previous?.css,
  };
}

export function mergeHostThemeContext(
  previous: HostThemeContext | undefined,
  update: HostThemeContext | undefined
): HostThemeContext | undefined {
  if (!update) return previous;

  const next: HostThemeContext = { ...previous };
  if ('theme' in update) {
    next.theme = update.theme;
  }
  if ('styles' in update) {
    next.styles = mergeHostStyles(previous?.styles, update.styles);
  }
  return next;
}

export function syncHostStyleVariables(
  root: HTMLElement,
  variables: McpUiStyles | undefined,
  previouslyAppliedKeys: ReadonlySet<string>
): Set<string> {
  const activeVariables = getActiveHostStyleVariables(variables);
  const nextAppliedKeys = new Set<string>(Object.keys(activeVariables ?? {}));

  for (const key of previouslyAppliedKeys) {
    if (!nextAppliedKeys.has(key)) {
      root.style.removeProperty(key);
    }
  }

  if (activeVariables) {
    applyHostStyleVariables(activeVariables, root);
  }

  return nextAppliedKeys;
}

export function clearHostStyleVariables(root: HTMLElement, appliedKeys: ReadonlySet<string>): void {
  for (const key of appliedKeys) {
    root.style.removeProperty(key);
  }
}
