/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

export type TelemetryMode = 'off' | 'console';

/**
 * When ELASTIC_MCP_TELEMETRY is 1, true, or "console", events are written as JSON lines to stderr
 * (stdout must stay clean for MCP stdio).
 *
 * Destination URL / batching TBD — wire a new mode + sink when ready.
 */
export function getTelemetryMode(): TelemetryMode {
  const raw = process.env.ELASTIC_MCP_TELEMETRY?.trim().toLowerCase();
  if (!raw || raw === '0' || raw === 'false' || raw === 'off') {
    return 'off';
  }
  if (raw === '1' || raw === 'true' || raw === 'console') {
    return 'console';
  }
  return 'off';
}
