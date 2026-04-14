/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EuiProvider } from '@elastic/eui';
import { McpAppProvider } from '../context/McpAppContext';
import { JsonUiApp } from './JsonUiApp';

function createMockApp() {
  return {
    callServerTool: vi
      .fn()
      .mockImplementation(async (request: { name: string; arguments: Record<string, unknown> }) => {
        if (request.name === 'app_only_get_json_ui_payload') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  uiId: 'action-ui',
                  spec: {
                    root: 'button',
                    elements: {
                      button: {
                        type: 'Button',
                        props: { label: 'Sync now' },
                        on: { press: { action: 'sync_state' } },
                        children: [],
                      },
                    },
                  },
                  state: { form: { name: 'Alice' } },
                  createdAt: '2026-01-01T00:00:00.000Z',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                }),
              },
            ],
          };
        }

        if (request.name === 'app_only_dispatch_json_ui_action') {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  action: 'sync_state',
                  message: 'State synced.',
                  payload: {
                    uiId: 'action-ui',
                    spec: {
                      root: 'button',
                      elements: {
                        button: {
                          type: 'Button',
                          props: { label: 'Sync now' },
                          on: { press: { action: 'sync_state' } },
                          children: [],
                        },
                      },
                    },
                    state: request.arguments.state,
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:01.000Z',
                  },
                }),
              },
            ],
          };
        }

        throw new Error(`Unexpected tool call: ${request.name}`);
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('JsonUiApp', () => {
  it('loads a payload and dispatches allowlisted actions through the MCP bridge', async () => {
    const app = createMockApp();

    render(
      <EuiProvider colorMode="light">
        <McpAppProvider app={app}>
          <JsonUiApp uiId="action-ui" />
        </McpAppProvider>
      </EuiProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Sync now')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sync now'));

    await waitFor(() => {
      expect(app.callServerTool).toHaveBeenCalledWith({
        name: 'app_only_dispatch_json_ui_action',
        arguments: {
          uiId: 'action-ui',
          action: 'sync_state',
          state: { form: { name: 'Alice' } },
        },
      });
    });
  });
});
