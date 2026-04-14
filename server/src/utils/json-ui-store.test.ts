/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { buildJsonUiDocument } from '@example-mcp-dashbuilder/json-render-contract';
import {
  clearJsonUiSnapshots,
  getJsonUiPayload,
  resetJsonUiState,
  setJsonUiSnapshot,
  syncJsonUiState,
} from './json-ui-store.js';

function makeDocument(label: string) {
  return buildJsonUiDocument(
    {
      root: 'root',
      elements: {
        root: {
          type: 'Text',
          props: { content: { $state: '/label' } },
          children: [],
        },
      },
    },
    { label }
  );
}

describe('json UI snapshot store', () => {
  beforeEach(() => {
    clearJsonUiSnapshots();
  });

  it('stores and retrieves payloads by immutable uiId', () => {
    setJsonUiSnapshot('summary-card', makeDocument('Alpha'));

    expect(getJsonUiPayload('summary-card')).toMatchObject({
      uiId: 'summary-card',
      state: { label: 'Alpha' },
    });
  });

  it('rejects duplicate uiIds so older snapshots remain stable', () => {
    setJsonUiSnapshot('summary-card', makeDocument('Alpha'));

    expect(() => setJsonUiSnapshot('summary-card', makeDocument('Beta'))).toThrow('already exists');
    expect(getJsonUiPayload('summary-card')?.state).toEqual({ label: 'Alpha' });
  });

  it('keeps snapshots isolated across uiIds when syncing and resetting state', () => {
    setJsonUiSnapshot('ui-one', makeDocument('One'));
    setJsonUiSnapshot('ui-two', makeDocument('Two'));

    syncJsonUiState('ui-one', { label: 'Updated One' });
    expect(getJsonUiPayload('ui-one')?.state).toEqual({ label: 'Updated One' });
    expect(getJsonUiPayload('ui-two')?.state).toEqual({ label: 'Two' });

    resetJsonUiState('ui-one');
    expect(getJsonUiPayload('ui-one')?.state).toEqual({ label: 'One' });
    expect(getJsonUiPayload('ui-two')?.state).toEqual({ label: 'Two' });
  });
});
