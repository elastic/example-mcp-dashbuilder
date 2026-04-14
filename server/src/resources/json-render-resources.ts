/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  buildJsonRenderBindingResource,
  buildJsonRenderCatalogResource,
  buildJsonRenderSchemaResource,
} from '@example-mcp-dashbuilder/json-render-contract';

export const JSON_RENDER_CATALOG_URI = 'json-render://catalog';
export const JSON_RENDER_SCHEMA_URI = 'json-render://schema';
export const JSON_RENDER_BINDING_REFERENCE_URI = 'json-render://binding-reference';

export function registerJsonRenderResources(server: McpServer): void {
  server.resource(
    'json-render-catalog',
    JSON_RENDER_CATALOG_URI,
    {
      description:
        'The shared json-render catalog for the MCP app. Read this before generating a schema-driven UI.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: JSON_RENDER_CATALOG_URI,
          mimeType: 'text/markdown',
          text: buildJsonRenderCatalogResource(),
        },
      ],
    })
  );

  server.resource(
    'json-render-schema',
    JSON_RENDER_SCHEMA_URI,
    {
      description:
        'JSON Schema exported from the shared json-render contract. Use it to validate generated UI specs.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: JSON_RENDER_SCHEMA_URI,
          mimeType: 'text/markdown',
          text: buildJsonRenderSchemaResource(),
        },
      ],
    })
  );

  server.resource(
    'json-render-binding-reference',
    JSON_RENDER_BINDING_REFERENCE_URI,
    {
      description:
        'Supported json-render bindings and allowlisted actions for the MCP app runtime.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: JSON_RENDER_BINDING_REFERENCE_URI,
          mimeType: 'text/markdown',
          text: buildJsonRenderBindingResource(),
        },
      ],
    })
  );
}
