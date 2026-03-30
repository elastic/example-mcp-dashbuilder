import React, { useMemo } from 'react';
import {
  Chart,
  Settings,
  Axis,
  BarSeries,
  LineSeries,
  AreaSeries,
  Partition,
  PartitionLayout,
  Metric,
  MetricTrendShape,
  Heatmap,
  Position,
  ScaleType,
} from '@elastic/charts';
import type { MetricDatum, HeatmapBandsColorScale } from '@elastic/charts';
import { ELASTIC_CHARTS_THEME, KIBANA_PALETTE } from '../theme';

// ── Type definitions ──

interface XYChartConfig {
  id: string;
  title: string;
  chartType: 'bar' | 'line' | 'area' | 'pie';
  xField: string;
  yFields: string[];
  splitField?: string;
  palette?: string[];
  data?: Record<string, unknown>[];
}

interface MetricPanelConfig {
  id: string;
  title: string;
  chartType: 'metric';
  subtitle?: string;
  color?: string;
  valueField?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  data?: Record<string, unknown>[];
  trendEsqlQuery?: string;
  trendXField?: string;
  trendYField?: string;
  trendShape?: 'area' | 'bars';
  trend?: {
    data: Array<{ x: number; y: number }>;
    shape: 'area' | 'bars';
  };
}

interface HeatmapPanelConfig {
  id: string;
  title: string;
  chartType: 'heatmap';
  xField: string;
  yField: string;
  valueField: string;
  colorRamp?: string[];
  data?: Record<string, unknown>[];
}

type PanelConfig = XYChartConfig | MetricPanelConfig | HeatmapPanelConfig;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateTime(d: Date): string {
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${month} ${day}, ${year} @ ${h}:${m}:${s}.${ms}`;
}

// ── Router ──

export function ChartPanel({ config }: { config: PanelConfig }) {
  if (config.chartType === 'metric') {
    return <MetricPanel config={config as MetricPanelConfig} />;
  }
  if (config.chartType === 'heatmap') {
    return <HeatmapPanel config={config as HeatmapPanelConfig} />;
  }
  return <XYChartPanel config={config as XYChartConfig} />;
}

// ── Metric ──

function MetricPanel({ config }: { config: MetricPanelConfig }) {
  const { id, title, subtitle, color, valueField, valuePrefix, valueSuffix, data, trend } = config;

  // Derive value from query data using valueField
  const displayValue =
    data && data.length > 0
      ? Number(valueField ? data[0][valueField] : Object.values(data[0])[0]) || 0
      : 0;

  const metricDatum: MetricDatum = {
    color: color || KIBANA_PALETTE[0],
    title,
    subtitle: subtitle || '',
    value: displayValue,
    valueFormatter: (v: number) => `${valuePrefix || ''}${v.toLocaleString()}${valueSuffix || ''}`,
    ...(trend && trend.data.length > 0
      ? {
          trend: trend.data,
          trendShape: trend.shape === 'bars' ? MetricTrendShape.Bars : MetricTrendShape.Area,
        }
      : {}),
  };

  return (
    <div style={{ height: '100%' }}>
      <Chart>
        <Settings theme={ELASTIC_CHARTS_THEME} />
        <Metric id={id} data={[[metricDatum]]} />
      </Chart>
    </div>
  );
}

// ── Heatmap ──

function buildColorScale(
  values: number[],
  steps = 8,
  customRamp?: string[]
): HeatmapBandsColorScale {
  const ramp = customRamp || [
    // Borealis temperature palette — euiPaletteForTemperature(8) from Kibana's EUI
    '#61A2FF',
    '#9AC2FF',
    '#CFE1FF',
    '#F2F7FE',
    '#FDF5F4',
    '#FFD4CF',
    '#FDA49C',
    '#F6726A',
  ];

  if (values.length === 0) {
    return { type: 'bands', bands: [{ start: 0, end: 1, color: ramp[0] }] };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = range / steps;

  const bands = ramp.map((color, i) => ({
    start: min + step * i,
    end: i === steps - 1 ? max + 1 : min + step * (i + 1),
    color,
  }));

  return { type: 'bands', bands };
}

function HeatmapPanel({ config }: { config: HeatmapPanelConfig }) {
  const { id, data = [], xField, yField, valueField, colorRamp } = config;

  const colorScale = useMemo(() => {
    const values = data.map((d) => Number(d[valueField])).filter((v) => !isNaN(v));
    return buildColorScale(values, 8, colorRamp);
  }, [data, valueField, colorRamp]);

  if (data.length === 0) return <p>No data</p>;

  return (
    <div style={{ height: '100%' }}>
      <Chart>
        <Settings
          theme={{
            ...ELASTIC_CHARTS_THEME,
            heatmap: {
              grid: {
                stroke: { width: 1, color: '#EDF0F5' },
              },
              cell: {
                border: { stroke: '#EDF0F5', strokeWidth: 1 },
              },
            },
          }}
          showLegend
          legendPosition={Position.Right}
        />
        <Heatmap
          id={id}
          data={data}
          colorScale={colorScale}
          xAccessor={xField}
          yAccessor={yField}
          valueAccessor={valueField}
          valueFormatter={(v: number) => v.toLocaleString()}
          xScale={{ type: ScaleType.Ordinal }}
          xAxisTitle={xField}
          yAxisTitle={yField}
          xAxisLabelName={xField}
          yAxisLabelName={yField}
          xAxisLabelFormatter={(v: string | number) => String(v)}
          yAxisLabelFormatter={(v: string | number) => String(v)}
        />
      </Chart>
    </div>
  );
}

// ── XY Charts (bar, line, area, pie) ──

/** True when x values should use a time scale. Avoids Date.parse on category labels — many strings
 * (e.g. "synthtrace-high-cardinality-0", "host-0") parse as valid dates in JS and break bar charts. */
function isLikelyTimeValue(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1e12;
  }
  if (typeof value !== 'string') return false;
  const s = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return false;
  const t = Date.parse(s);
  return !Number.isNaN(t);
}

function XYChartPanel({ config }: { config: XYChartConfig }) {
  const { id, chartType, data = [], xField, yFields, splitField, palette } = config;
  const colors = palette || KIBANA_PALETTE;

  if (data.length === 0) return <p>No data</p>;

  const firstXValue = data[0]?.[xField];
  const isTimeBased = isLikelyTimeValue(firstXValue);
  const xScaleType = isTimeBased ? ScaleType.Time : ScaleType.Ordinal;

  const chartData = isTimeBased
    ? data.map((row) => ({ ...row, [xField]: new Date(row[xField] as string).getTime() }))
    : data;

  return (
    <div style={{ height: '100%' }}>
      <Chart>
        <Settings
          theme={ELASTIC_CHARTS_THEME}
          showLegend={chartType === 'pie' || !!splitField || yFields.length > 1}
          legendPosition={Position.Right}
        />

        {chartType === 'pie' ? (
          <Partition
            id={id}
            data={chartData}
            layout={PartitionLayout.sunburst}
            valueAccessor={(d: Record<string, unknown>) => Number(d[yFields[0]]) || 0}
            layers={[
              {
                groupByRollup: (d: Record<string, unknown>) => d[xField],
                nodeLabel: (d: unknown) => String(d),
                shape: {
                  fillColor: (_key: unknown, sortIndex: number) =>
                    colors[sortIndex % colors.length],
                },
              },
            ]}
          />
        ) : (
          <>
            <Axis
              id="bottom"
              position={Position.Bottom}
              title={xField}
              tickFormat={isTimeBased ? (v) => formatDateTime(new Date(v)) : undefined}
            />
            <Axis
              id="left"
              position={Position.Left}
              title={yFields.length === 1 ? yFields[0] : undefined}
            />
            {yFields.map((yField, i) => {
              const Series =
                chartType === 'line' ? LineSeries : chartType === 'area' ? AreaSeries : BarSeries;
              return (
                <Series
                  key={`${id}-${yField}`}
                  id={`${id}-${yField}`}
                  name={yField}
                  color={palette ? colors[i % colors.length] : undefined}
                  data={chartData}
                  xAccessor={xField}
                  xScaleType={xScaleType}
                  yAccessors={[yField]}
                  splitSeriesAccessors={splitField ? [splitField] : undefined}
                />
              );
            })}
          </>
        )}
      </Chart>
    </div>
  );
}
