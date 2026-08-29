/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Shallow, privacy-safe summary of tool arguments: lengths and shapes only.
 */
export function buildArgsMetadata(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] = summarizeValue(value, 0);
  }
  return out;
}

function summarizeValue(value: unknown, depth: number): unknown {
  if (depth > 2) {
    return { deep: true };
  }
  if (value === null || value === undefined) {
    return { kind: 'empty' };
  }
  if (typeof value === 'string') {
    return { kind: 'string', len: value.length };
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { kind: typeof value };
  }
  if (Array.isArray(value)) {
    return { kind: 'array', len: value.length };
  }
  if (typeof value === 'object') {
    return {
      kind: 'object',
      keys: Object.keys(value as object).length,
    };
  }
  return { kind: 'unknown' };
}
