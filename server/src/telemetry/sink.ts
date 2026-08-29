/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { TelemetryEventV1 } from './types.js';
import { getTelemetryMode } from './config.js';

export type TelemetrySink = (event: TelemetryEventV1) => void;

const consoleSink: TelemetrySink = (event) => {
  // stderr only — never write telemetry JSON to stdout (MCP stdio).
  process.stderr.write(`${JSON.stringify({ type: 'mcp_telemetry', ...event })}\n`);
};

const noOp: TelemetrySink = () => {};

export function getTelemetrySink(): TelemetrySink {
  const mode = getTelemetryMode();
  if (mode === 'console') {
    return consoleSink;
  }
  return noOp;
}
