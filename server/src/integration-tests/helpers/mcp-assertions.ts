/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { expect } from 'vitest';
import type { CallToolResult, ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Extract the first text content block from a tool result.
 */
export function expectTextContent(result: CallToolResult): string {
  const text = result.content.find((c) => c.type === 'text');
  expect(text, 'Expected at least one text content block').toBeDefined();
  return (text as { type: 'text'; text: string }).text;
}

/**
 * Assert the tool call did not return an error.
 */
export function expectNoError(result: CallToolResult): void {
  expect(result.isError, `Tool returned error: ${JSON.stringify(result.content)}`).toBeFalsy();
}

/**
 * Assert a tool call succeeded and return its text content.
 */
export function expectSuccess(result: CallToolResult): string {
  expectNoError(result);
  return expectTextContent(result);
}

/**
 * Assert a named tool exists in the tools list.
 */
export function expectToolExists(tools: ListToolsResult, name: string): void {
  const names = tools.tools.map((t) => t.name);
  expect(names, `Tool "${name}" should be registered`).toContain(name);
}

/**
 * Assert multiple tools exist.
 */
export function expectToolsExist(tools: ListToolsResult, names: string[]): void {
  for (const name of names) {
    expectToolExists(tools, name);
  }
}

/**
 * Parse a JSON text content block from a tool result.
 */
export function parseJsonContent<T = unknown>(result: CallToolResult): T {
  const text = expectTextContent(result);
  try {
    return JSON.parse(text) as T;
  } catch {
    // Not JSON — return text as-is (many tools return plain text)
    return text as unknown as T;
  }
}
