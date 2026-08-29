/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { TelemetryEventV1 } from './types.js';
import { buildArgsMetadata } from './args-metadata.js';
import { inferIntent } from './intent.js';
import { getTelemetryMode } from './config.js';
import { getTelemetrySink } from './sink.js';

let cachedVersion: string | null = null;

function readServerVersion(): string {
  if (cachedVersion !== null) {
    return cachedVersion;
  }
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(here, '..', '..', 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version?: string };
      cachedVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
    } else {
      cachedVersion = '0.0.0';
    }
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

type RecordParams = {
  tool: string;
  durationMs: number;
  outcome: 'ok' | 'error';
  errorPhase?: 'validation' | 'handler';
  errorName?: string;
  mcpErrorResponse?: boolean;
  args: Record<string, unknown>;
};

/**
 * Record one tool invocation. No-op when telemetry is disabled.
 */
export function recordToolTelemetry(params: RecordParams): void {
  if (getTelemetryMode() === 'off') {
    return;
  }

  const event: TelemetryEventV1 = {
    v: 1,
    tool: params.tool,
    durationMs: params.durationMs,
    outcome: params.outcome,
    errorPhase: params.errorPhase,
    errorName: params.errorName,
    mcpErrorResponse: params.mcpErrorResponse,
    intent: inferIntent(params.tool, params.args),
    argsMeta: buildArgsMetadata(params.args),
    serverVersion: readServerVersion(),
  };

  try {
    getTelemetrySink()(event);
  } catch {
    // Never break tool execution for telemetry
  }
}
