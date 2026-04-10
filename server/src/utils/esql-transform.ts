/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { ESQLColumn, ESQLResponse } from '../types.js';

/**
 * Transform ES|QL columnar response into row-oriented objects
 * that Elastic Charts can consume.
 *
 * Input:  { columns: [{name: "a"}, {name: "b"}], values: [[1, "x"], [2, "y"]] }
 * Output: [{ a: 1, b: "x" }, { a: 2, b: "y" }]
 */
export function columnarToRows(response: ESQLResponse): Record<string, unknown>[] {
  const { columns, values } = response;
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col: ESQLColumn, i: number) => {
      obj[col.name] = row[i];
    });
    return obj;
  });
}

/**
 * Extract column names and types from an ES|QL response.
 */
export function describeColumns(response: ESQLResponse): Array<{ name: string; type: string }> {
  return response.columns.map((col) => ({ name: col.name, type: col.type }));
}

/**
 * Validate that expected fields exist in query results.
 * Returns an error message string if fields are missing, or null if all present.
 */
export function validateFields(data: Record<string, unknown>[], fields: string[]): string | null {
  const available = Object.keys(data[0]);
  const missing = fields.filter((f) => !available.includes(f));
  if (missing.length === 0) return null;
  return `Field(s) not found in query results: ${missing.join(', ')}. Available fields: ${available.join(', ')}`;
}
