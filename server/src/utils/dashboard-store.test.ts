/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  slugify,
  createDashboard,
  getDashboard,
  addChart,
  addSection,
  clearDashboard,
} from './dashboard-store.js';
import type { ChartConfig } from '../types.js';

const DASHBOARDS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'preview',
  'public',
  'dashboards'
);

describe('slugify', () => {
  it('converts title to lowercase slug', () => {
    expect(slugify('My Cool Dashboard')).toBe('my-cool-dashboard');
  });

  it('strips special characters', () => {
    expect(slugify('Sales & Revenue!!!')).toBe('sales-revenue');
  });

  it('returns untitled for empty string', () => {
    expect(slugify('')).toBe('untitled');
  });

  it('returns untitled for all special characters', () => {
    expect(slugify('!!!')).toBe('untitled');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello');
  });
});

describe('session isolation via dashboardId', () => {
  const chartA: ChartConfig = {
    id: 'chart-a',
    title: 'Chart A',
    chartType: 'bar',
    esqlQuery: 'FROM logs | STATS count = COUNT(*) BY host',
    xField: 'host',
    yFields: ['count'],
  };

  const chartB: ChartConfig = {
    id: 'chart-b',
    title: 'Chart B',
    chartType: 'line',
    esqlQuery: 'FROM logs | STATS bytes = SUM(bytes) BY @timestamp',
    xField: '@timestamp',
    yFields: ['bytes'],
  };

  const testIds = ['session-one', 'session-two'];

  beforeEach(() => {
    mkdirSync(DASHBOARDS_DIR, { recursive: true });
    createDashboard('Session One', 'session-one');
    createDashboard('Session Two', 'session-two');
  });

  afterEach(() => {
    // Clean up test dashboard files
    for (const id of testIds) {
      const path = resolve(DASHBOARDS_DIR, `${id}.json`);
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it('addChart with dashboardId only affects the targeted dashboard', () => {
    addChart(chartA, 'session-one');
    addChart(chartB, 'session-two');

    const one = getDashboard('session-one');
    const two = getDashboard('session-two');

    expect(one.charts).toHaveLength(1);
    expect(one.charts[0].id).toBe('chart-a');

    expect(two.charts).toHaveLength(1);
    expect(two.charts[0].id).toBe('chart-b');
  });

  it('clearDashboard with dashboardId only clears the targeted dashboard', () => {
    addChart(chartA, 'session-one');
    addChart(chartB, 'session-two');

    clearDashboard('session-one');

    const one = getDashboard('session-one');
    const two = getDashboard('session-two');

    expect(one.charts).toHaveLength(0);
    expect(two.charts).toHaveLength(1);
    expect(two.charts[0].id).toBe('chart-b');
  });

  it('addSection with dashboardId only affects the targeted dashboard', () => {
    addSection({ id: 'sec-1', title: 'KPIs', collapsed: false, panelIds: [] }, 'session-one');

    const one = getDashboard('session-one');
    const two = getDashboard('session-two');

    expect(one.sections).toHaveLength(1);
    expect(two.sections).toHaveLength(0);
  });
});
