/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { PartialTheme } from '@elastic/charts';
import { euiPaletteColorBlind } from '@elastic/eui';

export const KIBANA_PALETTE: string[] = euiPaletteColorBlind();

export const ELASTIC_CHARTS_THEME: PartialTheme = {
  background: {
    color: 'transparent',
  },
  colors: {
    vizColors: KIBANA_PALETTE,
    defaultVizColor: KIBANA_PALETTE[0],
  },
};
