import type { PartialTheme } from '@elastic/charts';

/**
 * Kibana Borealis theme — the new default Elastic visualization palette.
 * 12 colors: pairs of saturated (60) and light (30) variants.
 */
export const KIBANA_PALETTE: string[] = [
  '#16C5C0', // teal 60
  '#A6EDEA', // teal 30
  '#61A2FF', // blue 60
  '#BFDBFF', // blue 30
  '#EE72A6', // pink 60
  '#FFC7DB', // pink 30
  '#F6726A', // red 60
  '#FFC9C2', // red 30
  '#EAAE01', // yellow 60
  '#FCD883', // yellow 30
  '#B386F9', // purple 60
  '#E2D3FE', // purple 30
];

export const ELASTIC_CHARTS_THEME: PartialTheme = {
  background: {
    color: 'transparent',
  },
  colors: {
    vizColors: KIBANA_PALETTE,
    defaultVizColor: KIBANA_PALETTE[0],
  },
};
