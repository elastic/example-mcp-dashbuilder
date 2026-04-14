/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { buildJsonUiDocument } from '@example-mcp-dashbuilder/json-render-contract';
import { registerAppOnlyTool } from '../utils/register-tool.js';
import { JSON_UI_RESOURCE_URI } from '../utils/resource-uris.js';
import { loadMcpAppHtml } from '../utils/mcp-app-html.js';
import { setJsonUiSnapshot } from '../utils/json-ui-store.js';

const uiIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'uiId must contain only letters, numbers, hyphens, or underscores');

export function registerRenderJsonUi(server: McpServer): void {
  registerAppResource(
    server,
    'JSON UI Preview',
    JSON_UI_RESOURCE_URI,
    {
      description: 'Interactive json-render preview backed by the shared EUI component catalog.',
    },
    async () => ({
      contents: [
        {
          uri: JSON_UI_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: loadMcpAppHtml(),
        },
      ],
    })
  );

  registerAppOnlyTool(
    server,
    'render_json_ui',
    {
      title: 'Render JSON UI',
      description:
        'Render a small schema-driven UI inline in the chat using the shared json-render catalog. ' +
        'Read the json-render://catalog, json-render://schema, and json-render://binding-reference resources first. ' +
        'uiId values are immutable: reuse is rejected so older inline previews remain stable.',
      inputSchema: {
        uiId: uiIdSchema.describe('Unique immutable UI snapshot ID, e.g. "filters-panel-v1"'),
        spec: z
          .record(z.string(), z.unknown())
          .describe('A json-render spec that validates against the shared catalog/schema.'),
        initialState: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Optional initial state model. If omitted, spec.state is used when present.'),
      },
      _meta: {
        ui: { resourceUri: JSON_UI_RESOURCE_URI },
      },
    },
    async ({ uiId, spec, initialState }) => {
      try {
        const document = buildJsonUiDocument(spec, initialState);
        const payload = setJsonUiSnapshot(uiId, document);
        const elementCount = Object.keys(payload.spec.elements).length;

        return {
          content: [
            {
              type: 'text',
              text:
                `JSON UI "${uiId}" rendered with ${elementCount} element(s). ` +
                'The preview is immutable: use a new uiId for each distinct snapshot.',
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text', text: `Failed to render JSON UI: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
