/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { getESClient } from './es-client.js';
import { columnarToRows, validateFields } from './esql-transform.js';
import type { PanelConfig, ESQLResponse } from '../types.js';

interface ChartData {
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
}

/**
 * Execute an ES|QL query and return the rows.
 * Throws on query failure.
 */
export async function runEsqlQuery(query: string): Promise<Record<string, unknown>[]> {
  const client = getESClient();
  const response = (await client.esql.query({
    query,
    format: 'json',
  })) as unknown as ESQLResponse;
  return columnarToRows(response);
}

/**
 * Validate query results: check for empty data and that expected fields exist.
 * Returns an error string if invalid, or null if OK.
 */
export function validateChartData(
  data: Record<string, unknown>[],
  requiredFields: string[]
): string | null {
  if (data.length === 0) {
    return 'Query returned no results. Check the query and try again.';
  }
  return validateFields(data, requiredFields);
}

/**
 * Execute the ES|QL queries for a chart and return the data.
 * For metrics with a trend query, also fetches the trend data.
 */
export async function fetchChartData(chart: PanelConfig): Promise<ChartData> {
  const data = await runEsqlQuery(chart.esqlQuery);

  let trendData: Record<string, unknown>[] | undefined;
  if (chart.chartType === 'metric' && chart.trendEsqlQuery) {
    trendData = await runEsqlQuery(chart.trendEsqlQuery);
  }

  return { data, trendData };
}
