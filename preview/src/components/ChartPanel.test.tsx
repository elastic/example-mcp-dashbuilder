/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock @elastic/charts to avoid canvas rendering in jsdom
vi.mock('@elastic/charts', () => ({
  Chart: ({ children }: { children: React.ReactNode }) => <div data-testid="chart">{children}</div>,
  Settings: () => null,
  Axis: () => null,
  BarSeries: (props: { id: string }) => <div data-testid="bar-series" data-id={props.id} />,
  LineSeries: (props: { id: string }) => <div data-testid="line-series" data-id={props.id} />,
  AreaSeries: (props: { id: string }) => <div data-testid="area-series" data-id={props.id} />,
  Partition: (props: { id: string }) => <div data-testid="partition" data-id={props.id} />,
  Metric: (props: { id: string }) => <div data-testid="metric" data-id={props.id} />,
  Heatmap: (props: { id: string }) => <div data-testid="heatmap" data-id={props.id} />,
  PartitionLayout: { sunburst: 'sunburst' },
  MetricTrendShape: { Area: 'area', Bars: 'bars' },
  Position: { Bottom: 'bottom', Left: 'left', Right: 'right' },
  ScaleType: { Time: 'time', Ordinal: 'ordinal' },
}));

vi.mock('@elastic/eui', () => ({
  euiPaletteColorBlind: () => ['#16C5C0', '#A6EDEA', '#61A2FF'],
  euiPaletteForTemperature: () => [
    '#61A2FF',
    '#9AC2FF',
    '#CFE1FF',
    '#F2F7FE',
    '#FDF5F4',
    '#FFD4CF',
    '#FDA49C',
    '#F6726A',
  ],
  useEuiTheme: () => ({
    euiTheme: {
      border: {
        color: '#2F3D4C',
      },
    },
  }),
}));

import { ChartPanel } from './ChartPanel';
import type { RenderablePanelConfig } from '../types';

describe('ChartPanel', () => {
  it('renders bar chart', () => {
    const config: RenderablePanelConfig = {
      id: 'test-bar',
      title: 'Test Bar',
      chartType: 'bar',
      esqlQuery: 'FROM logs',
      xField: 'host',
      yFields: ['count'],
      data: [{ host: 'a', count: 10 }],
    };
    render(<ChartPanel config={config} />);
    expect(screen.getByTestId('bar-series')).toBeInTheDocument();
  });

  it('renders line chart', () => {
    const config: RenderablePanelConfig = {
      id: 'test-line',
      title: 'Test Line',
      chartType: 'line',
      esqlQuery: 'FROM logs',
      xField: 'time',
      yFields: ['bytes'],
      data: [{ time: '2024-01-01', bytes: 100 }],
    };
    render(<ChartPanel config={config} />);
    expect(screen.getByTestId('line-series')).toBeInTheDocument();
  });

  it('renders pie chart', () => {
    const config: RenderablePanelConfig = {
      id: 'test-pie',
      title: 'Test Pie',
      chartType: 'pie',
      esqlQuery: 'FROM logs',
      xField: 'status',
      yFields: ['count'],
      data: [{ status: '200', count: 50 }],
    };
    render(<ChartPanel config={config} />);
    expect(screen.getByTestId('partition')).toBeInTheDocument();
  });

  it('renders metric', () => {
    const config: RenderablePanelConfig = {
      id: 'test-metric',
      title: 'Total',
      chartType: 'metric',
      esqlQuery: 'FROM logs | STATS total = COUNT(*)',
      valueField: 'total',
      data: [{ total: 42 }],
    };
    render(<ChartPanel config={config} />);
    expect(screen.getByTestId('metric')).toBeInTheDocument();
  });

  it('renders heatmap', () => {
    const config: RenderablePanelConfig = {
      id: 'test-heatmap',
      title: 'Test Heatmap',
      chartType: 'heatmap',
      esqlQuery: 'FROM logs',
      xField: 'hour',
      yField: 'day',
      valueField: 'count',
      data: [{ hour: '10', day: 'Mon', count: 5 }],
    };
    render(<ChartPanel config={config} />);
    expect(screen.getByTestId('heatmap')).toBeInTheDocument();
  });

  it('shows "No data" for empty XY chart', () => {
    const config: RenderablePanelConfig = {
      id: 'empty',
      title: 'Empty',
      chartType: 'bar',
      esqlQuery: 'FROM logs',
      xField: 'x',
      yFields: ['y'],
      data: [],
    };
    render(<ChartPanel config={config} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('shows "No data" for empty heatmap', () => {
    const config: RenderablePanelConfig = {
      id: 'empty-hm',
      title: 'Empty',
      chartType: 'heatmap',
      esqlQuery: 'FROM logs',
      xField: 'x',
      yField: 'y',
      valueField: 'v',
      data: [],
    };
    render(<ChartPanel config={config} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
