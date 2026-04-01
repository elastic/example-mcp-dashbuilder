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
