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
