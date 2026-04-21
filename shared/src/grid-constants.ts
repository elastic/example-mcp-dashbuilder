/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

// Grid layout constants shared across dashboard translators.

export const HALF_WIDTH = 24;
export const THREE_QUARTER_WIDTH = 36;
export const QUARTER_WIDTH = 12;
export const DEFAULT_HEIGHT = 15;
export const METRIC_HEIGHT = 10;
export const GRID_COLUMN_COUNT = 48;

export const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  bar: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  line: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  area: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  pie: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  metric: { w: QUARTER_WIDTH, h: METRIC_HEIGHT },
  heatmap: { w: THREE_QUARTER_WIDTH, h: DEFAULT_HEIGHT },
};
