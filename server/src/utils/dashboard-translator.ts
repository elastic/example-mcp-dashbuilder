import { randomUUID } from 'crypto';
import type { DashboardConfig, PanelConfig } from '../types.js';
import { translatePanelToLens } from './lens-translator.js';
import type { TimeFieldContext } from './lens-translator.js';
import { parseIndexPattern } from './esql-parser.js';

const HALF_WIDTH = 24;
const THREE_QUARTER_WIDTH = 36;
const QUARTER_WIDTH = 12;
const DEFAULT_HEIGHT = 15;
const METRIC_HEIGHT = 10;

const DEFAULT_SIZES: Record<string, { w: number; h: number }> = {
  bar: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  line: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  area: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  pie: { w: HALF_WIDTH, h: DEFAULT_HEIGHT },
  metric: { w: QUARTER_WIDTH, h: METRIC_HEIGHT },
  heatmap: { w: THREE_QUARTER_WIDTH, h: DEFAULT_HEIGHT },
};

interface SavedDashboardPanel {
  panelIndex: string;
  type: string;
  gridData: { x: number; y: number; w: number; h: number; i: string; sectionId?: string };
  embeddableConfig: Record<string, unknown>;
}

function buildSavedPanel(
  chart: PanelConfig,
  grid: { x: number; y: number; w: number; h: number },
  sectionId?: string,
  ctx?: TimeFieldContext
): SavedDashboardPanel {
  const panelIndex = randomUUID();
  const { attributes } = translatePanelToLens(chart, ctx);

  return {
    panelIndex,
    type: 'lens',
    gridData: {
      ...grid,
      i: panelIndex,
      ...(sectionId ? { sectionId } : {}),
    },
    embeddableConfig: { attributes },
  };
}

/**
 * Auto-place panels in a flowing layout (fallback when no grid positions stored).
 */
function autoPlacePanels(
  charts: PanelConfig[],
  startRow: number = 0,
  sectionId?: string,
  ctxFn?: (chart: PanelConfig) => TimeFieldContext | undefined
): { panels: SavedDashboardPanel[]; nextRow: number } {
  const panels: SavedDashboardPanel[] = [];
  let nextRow = startRow;
  let colOffset = 0;
  let maxHeightInRow = 0;

  for (const chart of charts) {
    const size = DEFAULT_SIZES[chart.chartType] || DEFAULT_SIZES.bar;
    if (colOffset + size.w > 48) {
      nextRow += maxHeightInRow;
      colOffset = 0;
      maxHeightInRow = 0;
    }
    panels.push(
      buildSavedPanel(
        chart,
        { x: colOffset, y: nextRow, w: size.w, h: size.h },
        sectionId,
        ctxFn?.(chart)
      )
    );
    colOffset += size.w;
    maxHeightInRow = Math.max(maxHeightInRow, size.h);
    if (colOffset >= 48) {
      nextRow += maxHeightInRow;
      colOffset = 0;
      maxHeightInRow = 0;
    }
  }
  if (colOffset > 0) nextRow += maxHeightInRow;
  return { panels, nextRow };
}

/**
 * Translate the MCP dashboard config into the saved_objects API format.
 * Uses grid positions from dashboard.json if the user has dragged/resized panels.
 */
export function translateDashboardToSavedObject(
  config: DashboardConfig,
  timeFieldMap?: Map<string, string>
): {
  attributes: Record<string, unknown>;
  references: Array<{ name: string; type: string; id: string }>;
} {
  const sections = config.sections || [];
  const chartMap = new Map(config.charts.map((c) => [c.id, c]));
  const gridLayout = config.gridLayout;

  // Build TimeFieldContext for a chart from the index→timeField map
  function getCtx(chart: PanelConfig): TimeFieldContext | undefined {
    if (!timeFieldMap || !chart.esqlQuery) return undefined;
    const index = parseIndexPattern(chart.esqlQuery);
    if (!index) return undefined;
    const timeField = timeFieldMap.get(index);
    if (!timeField) return undefined;
    return { indexPattern: index, timeField };
  }

  const assignedPanelIds = new Set<string>();
  for (const section of sections) {
    for (const panelId of section.panelIds) {
      assignedPanelIds.add(panelId);
    }
  }

  let allPanels: SavedDashboardPanel[];
  const sectionsArray: Array<{
    title: string;
    collapsed: boolean;
    gridData: { y: number; i: string };
  }> = [];

  if (gridLayout) {
    // Use positions from user's drag/resize in the preview app
    allPanels = [];

    interface GridPanel {
      type: 'panel';
      column: number;
      row: number;
      width: number;
      height: number;
    }

    interface GridSection {
      type: 'section';
      title: string;
      isCollapsed?: boolean;
      row: number;
      panels?: Record<string, { column: number; row: number; width: number; height: number }>;
    }

    type GridWidget = GridPanel | GridSection;

    for (const [widgetId, widget] of Object.entries(gridLayout) as Array<[string, GridWidget]>) {
      if (widget.type === 'panel') {
        const chart = chartMap.get(widgetId);
        if (chart) {
          allPanels.push(
            buildSavedPanel(
              chart,
              { x: widget.column, y: widget.row, w: widget.width, h: widget.height },
              undefined,
              getCtx(chart)
            )
          );
        }
      } else if (widget.type === 'section') {
        sectionsArray.push({
          title: widget.title,
          collapsed: widget.isCollapsed ?? false,
          gridData: { y: widget.row, i: widgetId },
        });

        if (widget.panels) {
          for (const [panelId, panel] of Object.entries(widget.panels)) {
            const chart = chartMap.get(panelId);
            if (chart) {
              allPanels.push(
                buildSavedPanel(
                  chart,
                  { x: panel.column, y: panel.row, w: panel.width, h: panel.height },
                  widgetId,
                  getCtx(chart)
                )
              );
            }
          }
        }
      }
    }
  } else {
    // Fallback: auto-place
    const unassignedCharts = config.charts.filter((c) => !assignedPanelIds.has(c.id));
    const { panels: topLevelPanels, nextRow: afterTopLevel } = autoPlacePanels(
      unassignedCharts,
      0,
      undefined,
      getCtx
    );
    allPanels = [...topLevelPanels];

    let sectionRow = afterTopLevel;
    for (const section of sections) {
      const sectionCharts = section.panelIds
        .map((id) => chartMap.get(id))
        .filter((c): c is PanelConfig => c !== undefined);

      const { panels: sectionPanels } = autoPlacePanels(sectionCharts, 0, section.id, getCtx);
      sectionsArray.push({
        title: section.title,
        collapsed: section.collapsed,
        gridData: { y: sectionRow, i: section.id },
      });
      allPanels = [...allPanels, ...sectionPanels];
      sectionRow++;
    }
  }

  const options = {
    hidePanelTitles: false,
    useMargins: true,
    syncColors: false,
    syncCursor: true,
    syncTooltips: false,
  };

  return {
    attributes: {
      title: config.title,
      description: `Exported from MCP Dashboard App on ${new Date().toLocaleDateString()}`,
      panelsJSON: JSON.stringify(allPanels),
      optionsJSON: JSON.stringify(options),
      ...(sectionsArray.length > 0 ? { sections: sectionsArray } : {}),
    },
    references: [],
  };
}
