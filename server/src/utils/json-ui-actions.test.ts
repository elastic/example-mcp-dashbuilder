/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildJsonUiDocument } from '@example-mcp-dashbuilder/json-render-contract';
import { clearJsonUiSnapshots, setJsonUiSnapshot } from './json-ui-store.js';
import { dispatchJsonUiAction } from './json-ui-actions.js';

describe('dispatchJsonUiAction', () => {
  beforeEach(() => {
    clearJsonUiSnapshots();
    setJsonUiSnapshot(
      'actionable-ui',
      buildJsonUiDocument(
        {
          root: 'root',
          elements: {
            root: {
              type: 'Button',
              props: { label: 'Sync' },
              children: [],
            },
          },
        },
        { count: 1 }
      )
    );
  });

  it('syncs state only when a state payload is provided', () => {
    expect(() => dispatchJsonUiAction('actionable-ui', 'sync_state')).toThrow(
      'requires a state payload'
    );

    const result = dispatchJsonUiAction('actionable-ui', 'sync_state', { count: 2 });
    expect(result.action).toBe('sync_state');
    expect(result.payload.state).toEqual({ count: 2 });
  });

  it('resets and refreshes snapshots through the allowlisted actions', () => {
    dispatchJsonUiAction('actionable-ui', 'sync_state', { count: 3 });

    const reset = dispatchJsonUiAction('actionable-ui', 'reset_state');
    expect(reset.payload.state).toEqual({ count: 1 });

    const refresh = dispatchJsonUiAction('actionable-ui', 'refresh_ui');
    expect(refresh.payload.state).toEqual({ count: 1 });
  });
});
