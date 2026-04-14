/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { JsonUiSpec, JsonUiState } from './catalog';

export interface JsonUiPayload {
  uiId: string;
  spec: JsonUiSpec;
  state: JsonUiState;
  createdAt: string;
  updatedAt: string;
}

export interface JsonUiActionResult {
  action: 'sync_state' | 'reset_state' | 'refresh_ui';
  message: string;
  payload: JsonUiPayload;
}
