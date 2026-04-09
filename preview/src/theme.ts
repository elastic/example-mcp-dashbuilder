import type { PartialTheme } from '@elastic/charts';
import { euiPaletteColorBlind } from '@elastic/eui';

export const KIBANA_PALETTE: string[] = euiPaletteColorBlind();

export function getElasticChartsTheme(heatmapBorderColor: string): PartialTheme {
  return {
    background: {
      color: 'transparent',
    },
    colors: {
      vizColors: KIBANA_PALETTE,
      defaultVizColor: KIBANA_PALETTE[0],
    },
    heatmap: {
      grid: {
        stroke: { width: 1, color: heatmapBorderColor },
      },
      cell: {
        border: { stroke: heatmapBorderColor, strokeWidth: 1 },
      },
    },
  };
}
