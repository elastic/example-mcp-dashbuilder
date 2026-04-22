/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { maskValue, buildPrompt } from './setup-helpers.js';

describe('maskValue', () => {
  it('masks short values completely', () => {
    expect(maskValue('')).toBe('****');
    expect(maskValue('ab')).toBe('****');
    expect(maskValue('abcd1234')).toBe('****');
    expect(maskValue('12345678901')).toBe('****');
  });

  it('shows last 4 characters for values with 12+ characters', () => {
    expect(maskValue('123456789012')).toBe('****9012');
    expect(maskValue('my-secret-api-key-xY3Q')).toBe('****xY3Q');
  });
});

describe('buildPrompt', () => {
  it('shows default in plain text when not sensitive', () => {
    expect(buildPrompt('Username', 'elastic')).toBe('Username [elastic]: ');
  });

  it('masks default when sensitive', () => {
    expect(buildPrompt('API Key', 'super-secret-key-xY3Q', true)).toBe('API Key [****xY3Q]: ');
  });

  it('shows no default when value is empty', () => {
    expect(buildPrompt('API Key', '', true)).toBe('API Key: ');
  });

  it('shows no default when value is undefined', () => {
    expect(buildPrompt('API Key')).toBe('API Key: ');
    expect(buildPrompt('API Key', undefined, true)).toBe('API Key: ');
  });
});
