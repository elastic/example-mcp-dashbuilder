/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppTool as sdkRegisterAppTool } from '@modelcontextprotocol/ext-apps/server';
import { z, type ZodRawShape, type ZodObject } from 'zod';
import { recordToolTelemetry } from '../telemetry/record.js';

type ToolResult = {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
};

function wrapHandlerWithTelemetry<T extends ZodRawShape>(
  name: string,
  schema: z.ZodObject<T>,
  handler: (args: z.infer<ZodObject<T>>) => Promise<ToolResult>
): (args: Record<string, unknown>) => Promise<ToolResult> {
  return async (args: Record<string, unknown>) => {
    const t0 = Date.now();
    let parsed: z.infer<ZodObject<T>> | undefined;
    try {
      parsed = schema.parse(args);
    } catch (e) {
      const durationMs = Date.now() - t0;
      if (e instanceof z.ZodError) {
        recordToolTelemetry({
          tool: name,
          durationMs,
          outcome: 'error',
          errorPhase: 'validation',
          errorName: e.name,
          args: args as Record<string, unknown>,
        });
      }
      throw e;
    }
    try {
      const result = await handler(parsed);
      const durationMs = Date.now() - t0;
      recordToolTelemetry({
        tool: name,
        durationMs,
        outcome: 'ok',
        mcpErrorResponse: result.isError === true,
        args: parsed as Record<string, unknown>,
      });
      return result;
    } catch (e) {
      const durationMs = Date.now() - t0;
      const err = e as Error;
      recordToolTelemetry({
        tool: name,
        durationMs,
        outcome: 'error',
        errorPhase: 'handler',
        errorName: err?.name ?? 'Error',
        args: parsed as Record<string, unknown>,
      });
      throw e;
    }
  };
}

/**
 * Wrapper around server.registerTool that avoids the
 * "Type instantiation is excessively deep" TS error
 * caused by the MCP SDK's deeply nested generics.
 *
 * Parses args through the Zod schema so handlers receive typed values.
 */
export function registerTool<T extends ZodRawShape>(
  server: McpServer,
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema: T;
  },
  handler: (args: z.infer<ZodObject<T>>) => Promise<ToolResult>
): void {
  const schema = z.object(config.inputSchema);
  const wrappedHandler = wrapHandlerWithTelemetry(name, schema, handler);

  // @ts-expect-error — MCP SDK generic recursion too deep for TS
  server.registerTool(name, config, wrappedHandler);
}

/**
 * Wrapper around registerAppTool that avoids the same TS2589 error.
 * Parses args through the Zod schema so handlers receive typed values.
 * Supports both app-only tools (visibility) and UI tools (resourceUri).
 */
export function registerAppOnlyTool<T extends ZodRawShape>(
  server: McpServer,
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema: T;
    _meta?: { ui: { visibility?: string[]; resourceUri?: string } };
  },
  handler: (args: z.infer<ZodObject<T>>) => Promise<ToolResult>
): void {
  const schema = z.object(config.inputSchema);
  const wrappedHandler = wrapHandlerWithTelemetry(name, schema, handler);

  // @ts-expect-error — MCP SDK generic recursion too deep for TS
  sdkRegisterAppTool(server, name, config, wrappedHandler);
}
