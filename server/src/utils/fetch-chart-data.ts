/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { getESClient } from './es-client.js';
import { columnarToRows } from './esql-transform.js';
import type { PanelConfig, ESQLResponse } from '../types.js';

export interface ChartData {
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
}

/**
 * Execute the ES|QL queries for a chart and return the data.
 * For metrics with a trend query, also fetches the trend data.
 */
export async function fetchChartData(chart: PanelConfig): Promise<ChartData> {
  const client = getESClient();

  const response = (await client.esql.query({
    query: chart.esqlQuery,
    format: 'json',
  })) as unknown as ESQLResponse;
  const data = columnarToRows(response);

  let trendData: Record<string, unknown>[] | undefined;
  if (chart.chartType === 'metric' && chart.trendEsqlQuery) {
    const trendResponse = (await client.esql.query({
      query: chart.trendEsqlQuery,
      format: 'json',
    })) as unknown as ESQLResponse;
    trendData = columnarToRows(trendResponse);
  }

  return { data, trendData };
}
