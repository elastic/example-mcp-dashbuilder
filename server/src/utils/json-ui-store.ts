/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type {
  JsonUiDocument,
  JsonUiSpec,
  JsonUiState,
} from '@example-mcp-dashbuilder/json-render-contract';

const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SNAPSHOTS = 100;

export interface JsonUiSnapshot {
  uiId: string;
  spec: JsonUiSpec;
  initialState: JsonUiState;
  currentState: JsonUiState;
  createdAt: string;
  updatedAt: string;
}

export interface JsonUiPayload {
  uiId: string;
  spec: JsonUiSpec;
  state: JsonUiState;
  createdAt: string;
  updatedAt: string;
}

const snapshots = new Map<string, JsonUiSnapshot>();

function cloneState(state: JsonUiState): JsonUiState {
  return structuredClone(state);
}

function cloneSpec(spec: JsonUiSpec): JsonUiSpec {
  return structuredClone(spec);
}

function toPayload(snapshot: JsonUiSnapshot): JsonUiPayload {
  return {
    uiId: snapshot.uiId,
    spec: cloneSpec(snapshot.spec),
    state: cloneState(snapshot.currentState),
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}

function pruneExpiredSnapshots(now = Date.now()): void {
  for (const [uiId, snapshot] of snapshots.entries()) {
    const updatedAt = Date.parse(snapshot.updatedAt);
    if (Number.isNaN(updatedAt) || now - updatedAt > SNAPSHOT_TTL_MS) {
      snapshots.delete(uiId);
    }
  }
}

function pruneOverflowSnapshots(): void {
  if (snapshots.size <= MAX_SNAPSHOTS) {
    return;
  }

  const oldestFirst = [...snapshots.entries()].sort(
    (a, b) => Date.parse(a[1].updatedAt) - Date.parse(b[1].updatedAt)
  );

  for (const [uiId] of oldestFirst.slice(0, snapshots.size - MAX_SNAPSHOTS)) {
    snapshots.delete(uiId);
  }
}

function requireSnapshot(uiId: string): JsonUiSnapshot {
  pruneExpiredSnapshots();
  const snapshot = snapshots.get(uiId);
  if (!snapshot) {
    throw new Error(`JSON UI snapshot "${uiId}" not found.`);
  }
  return snapshot;
}

export function setJsonUiSnapshot(uiId: string, document: JsonUiDocument): JsonUiPayload {
  pruneExpiredSnapshots();

  if (snapshots.has(uiId)) {
    throw new Error(`JSON UI snapshot "${uiId}" already exists. Use a new uiId.`);
  }

  const now = new Date().toISOString();
  const snapshot: JsonUiSnapshot = {
    uiId,
    spec: cloneSpec(document.spec),
    initialState: cloneState(document.initialState),
    currentState: cloneState(document.initialState),
    createdAt: now,
    updatedAt: now,
  };

  snapshots.set(uiId, snapshot);
  pruneOverflowSnapshots();
  return toPayload(snapshot);
}

export function getJsonUiPayload(uiId: string): JsonUiPayload | null {
  pruneExpiredSnapshots();
  const snapshot = snapshots.get(uiId);
  return snapshot ? toPayload(snapshot) : null;
}

export function syncJsonUiState(uiId: string, state: JsonUiState): JsonUiPayload {
  const snapshot = requireSnapshot(uiId);
  snapshot.currentState = cloneState(state);
  snapshot.updatedAt = new Date().toISOString();
  return toPayload(snapshot);
}

export function resetJsonUiState(uiId: string): JsonUiPayload {
  const snapshot = requireSnapshot(uiId);
  snapshot.currentState = cloneState(snapshot.initialState);
  snapshot.updatedAt = new Date().toISOString();
  return toPayload(snapshot);
}

export function refreshJsonUiPayload(uiId: string): JsonUiPayload {
  return toPayload(requireSnapshot(uiId));
}

export function clearJsonUiSnapshots(): void {
  snapshots.clear();
}
