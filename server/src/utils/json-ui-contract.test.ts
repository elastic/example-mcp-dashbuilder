/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, expect, it } from 'vitest';
import {
  buildJsonRenderBindingResource,
  buildJsonRenderCatalogResource,
  buildJsonRenderSchemaResource,
  buildJsonUiDocument,
  parseJsonUiSpec,
} from '@example-mcp-dashbuilder/json-render-contract';

describe('json-render contract', () => {
  it('preserves state, repeat, and action bindings when parsing specs', () => {
    const parsed = parseJsonUiSpec({
      root: 'root',
      elements: {
        root: {
          type: 'Panel',
          props: { title: 'Tasks' },
          repeat: { statePath: '/tasks', key: 'id' },
          children: ['row'],
        },
        row: {
          type: 'Button',
          props: { label: { $item: 'title' } },
          on: { press: { action: 'sync_state' } },
          children: [],
        },
      },
      state: {
        tasks: [{ id: '1', title: 'Review' }],
      },
    });

    expect(parsed.state).toEqual({
      tasks: [{ id: '1', title: 'Review' }],
    });
    expect(parsed.elements.root.repeat).toEqual({ statePath: '/tasks', key: 'id' });
    expect(parsed.elements.row.on).toEqual({ press: { action: 'sync_state' } });
  });

  it('prefers explicit initial state over spec.state when building documents', () => {
    const document = buildJsonUiDocument(
      {
        root: 'root',
        elements: {
          root: {
            type: 'Text',
            props: { content: { $state: '/name' } },
            children: [],
          },
        },
        state: { name: 'Spec value' },
      },
      { name: 'Explicit value' }
    );

    expect(document.initialState).toEqual({ name: 'Explicit value' });
  });

  it('builds readable resource content from the shared contract', () => {
    expect(buildJsonRenderCatalogResource()).toContain('`TextInput`');
    expect(buildJsonRenderCatalogResource()).toContain('`sync_state`');
    expect(buildJsonRenderBindingResource()).toContain('`$bindState`');
    expect(buildJsonRenderSchemaResource()).toContain('"Panel"');
  });
});
