/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

export {
  HALF_WIDTH,
  THREE_QUARTER_WIDTH,
  QUARTER_WIDTH,
  DEFAULT_HEIGHT,
  METRIC_HEIGHT,
  GRID_COLUMN_COUNT,
  DEFAULT_SIZES,
} from './grid-constants.js';

export { autoPlacePanels, buildBalancedRowWidths } from './auto-place.js';

export type { PlaceablePanel, GridPlacement } from './auto-place.js';
