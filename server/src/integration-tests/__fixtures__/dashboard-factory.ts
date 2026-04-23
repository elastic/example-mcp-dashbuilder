/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { TEST_INDEX } from '../setup/seed-data.js';

/**
 * Sample tool arguments for integration tests.
 * All queries target the `test_ecommerce` index seeded by global setup.
 */

export const SAMPLE_BAR_CHART_ARGS = {
  title: 'Revenue by Category',
  chartType: 'bar' as const,
  esqlQuery: `FROM ${TEST_INDEX} | STATS revenue = SUM(taxful_total_price) BY category`,
  xField: 'category',
  yFields: ['revenue'],
};

export const SAMPLE_LINE_CHART_ARGS = {
  title: 'Orders Over Time',
  chartType: 'line' as const,
  esqlQuery: `FROM ${TEST_INDEX} | STATS orders = COUNT(*) BY order_date = BUCKET(order_date, 1 day)`,
  xField: 'order_date',
  yFields: ['orders'],
};

export const SAMPLE_METRIC_ARGS = {
  title: 'Total Revenue',
  esqlQuery: `FROM ${TEST_INDEX} | STATS total = SUM(taxful_total_price)`,
  valueField: 'total',
  format: 'currency' as const,
};

export const SAMPLE_HEATMAP_ARGS = {
  title: 'Category by Gender',
  esqlQuery: `FROM ${TEST_INDEX} | STATS count = COUNT(*) BY category, customer_gender`,
  xField: 'category',
  yField: 'customer_gender',
  valueField: 'count',
};
