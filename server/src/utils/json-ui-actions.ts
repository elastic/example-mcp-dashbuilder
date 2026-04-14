/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { JsonUiState } from '@example-mcp-dashbuilder/json-render-contract';
import {
  refreshJsonUiPayload,
  resetJsonUiState,
  syncJsonUiState,
  type JsonUiPayload,
} from './json-ui-store.js';

export type JsonUiActionName = 'sync_state' | 'reset_state' | 'refresh_ui';

export interface JsonUiActionDispatchResult {
  action: JsonUiActionName;
  message: string;
  payload: JsonUiPayload;
}

export function dispatchJsonUiAction(
  uiId: string,
  action: JsonUiActionName,
  state?: JsonUiState
): JsonUiActionDispatchResult {
  switch (action) {
    case 'sync_state': {
      if (!state) {
        throw new Error('sync_state requires a state payload.');
      }

      return {
        action,
        message: 'State synced.',
        payload: syncJsonUiState(uiId, state),
      };
    }
    case 'reset_state':
      return {
        action,
        message: 'State reset.',
        payload: resetJsonUiState(uiId),
      };
    case 'refresh_ui':
      return {
        action,
        message: 'Snapshot refreshed.',
        payload: refreshJsonUiPayload(uiId),
      };
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unsupported JSON UI action: ${String(exhaustiveCheck)}`);
    }
  }
}
