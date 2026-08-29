/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * One telemetry event per tool invocation. Schema versioned for forward compatibility.
 * Does not include raw user strings, queries, or secrets.
 */
export type TelemetryEventV1 = {
  v: 1;
  tool: string;
  durationMs: number;
  /** Threw in handler, or Zod parse failed */
  outcome: 'ok' | 'error';
  errorPhase?: 'validation' | 'handler';
  /** e.g. ZodError — not the message */
  errorName?: string;
  /** Tool returned result with isError: true (MCP-level error response) */
  mcpErrorResponse?: boolean;
  intent?: string;
  argsMeta?: Record<string, unknown>;
  serverVersion: string;
};
