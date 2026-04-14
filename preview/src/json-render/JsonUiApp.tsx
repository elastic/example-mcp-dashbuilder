/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createStateStore, JSONUIProvider, Renderer } from '@json-render/react';
import { EuiCallOut, EuiLoadingSpinner, EuiPanel, EuiSpacer, EuiText } from '@elastic/eui';
import { useMcpApp } from '../context/McpAppContext';
import { jsonUiRegistry } from './registry';
import type { JsonUiActionResult, JsonUiPayload } from './types';

interface ToolResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

function getToolText(result: ToolResult): string {
  const textBlock = result.content?.find((item) => item.type === 'text');
  if (!textBlock?.text) {
    throw new Error('The MCP server did not return a text payload.');
  }
  return textBlock.text;
}

function parseToolJson<T>(result: ToolResult): T {
  const text = getToolText(result);
  return JSON.parse(text) as T;
}

export function JsonUiApp({ uiId }: { uiId: string }) {
  const mcpApp = useMcpApp();
  const [payload, setPayload] = useState<JsonUiPayload | null>(null);
  const [store, setStore] = useState(() => createStateStore({}));
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadPayload = useCallback(async () => {
    const result = await mcpApp.callServerTool({
      name: 'app_only_get_json_ui_payload',
      arguments: { uiId },
    });

    if (result.isError) {
      throw new Error(getToolText(result));
    }

    const nextPayload = parseToolJson<JsonUiPayload>(result);
    setPayload(nextPayload);
    setStore(createStateStore(nextPayload.state));
    setError(null);
  }, [mcpApp, uiId]);

  useEffect(() => {
    loadPayload().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [loadPayload]);

  const actionHandlers = useMemo(
    () => ({
      sync_state: async () => {
        const result = await mcpApp.callServerTool({
          name: 'app_only_dispatch_json_ui_action',
          arguments: {
            uiId,
            action: 'sync_state',
            state: store.getSnapshot(),
          },
        });

        if (result.isError) {
          throw new Error(getToolText(result));
        }

        const actionResult = parseToolJson<JsonUiActionResult>(result);
        setPayload(actionResult.payload);
        setStatusMessage(actionResult.message);
      },
      reset_state: async () => {
        const result = await mcpApp.callServerTool({
          name: 'app_only_dispatch_json_ui_action',
          arguments: {
            uiId,
            action: 'reset_state',
          },
        });

        if (result.isError) {
          throw new Error(getToolText(result));
        }

        const actionResult = parseToolJson<JsonUiActionResult>(result);
        setPayload(actionResult.payload);
        setStore(createStateStore(actionResult.payload.state));
        setStatusMessage(actionResult.message);
      },
      refresh_ui: async () => {
        const result = await mcpApp.callServerTool({
          name: 'app_only_dispatch_json_ui_action',
          arguments: {
            uiId,
            action: 'refresh_ui',
          },
        });

        if (result.isError) {
          throw new Error(getToolText(result));
        }

        const actionResult = parseToolJson<JsonUiActionResult>(result);
        setPayload(actionResult.payload);
        setStore(createStateStore(actionResult.payload.state));
        setStatusMessage(actionResult.message);
      },
    }),
    [mcpApp, store, uiId]
  );

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <EuiCallOut title="JSON UI failed to load" color="danger" iconType="warning">
          <p>{error}</p>
        </EuiCallOut>
      </div>
    );
  }

  if (!payload) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <EuiLoadingSpinner size="xl" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      {statusMessage ? (
        <>
          <EuiPanel paddingSize="s" hasBorder color="subdued">
            <EuiText size="s">
              <p style={{ margin: 0 }}>{statusMessage}</p>
            </EuiText>
          </EuiPanel>
          <EuiSpacer size="m" />
        </>
      ) : null}
      <JSONUIProvider registry={jsonUiRegistry} store={store} handlers={actionHandlers}>
        <Renderer spec={payload.spec} registry={jsonUiRegistry} />
      </JSONUIProvider>
    </div>
  );
}
