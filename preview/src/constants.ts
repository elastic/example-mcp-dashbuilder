/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { GridSettings } from './grid-layout';

export const ALL_DATA_SENTINEL = '__all_data__';

export interface DurationRange {
  end: string;
  label?: string;
  start: string;
}

export const COMMONLY_USED_RANGES: DurationRange[] = [
  { start: ALL_DATA_SENTINEL, end: 'now', label: 'All data' },
  { start: 'now-15m', end: 'now', label: 'Last 15 minutes' },
  { start: 'now-1h', end: 'now', label: 'Last 1 hour' },
  { start: 'now-24h', end: 'now', label: 'Last 24 hours' },
  { start: 'now-7d', end: 'now', label: 'Last 7 days' },
  { start: 'now-30d', end: 'now', label: 'Last 30 days' },
  { start: 'now-1y', end: 'now', label: 'Last 1 year' },
];

export const GRID_SETTINGS: GridSettings = {
  gutterSize: 8,
  rowHeight: 20,
  columnCount: 48,
  keyboardDragTopLimit: 0,
};
