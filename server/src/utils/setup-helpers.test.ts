/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { maskValue, buildPrompt } from './setup-helpers.js';

describe('maskValue', () => {
  it('always returns ****', () => {
    expect(maskValue('')).toBe('****');
    expect(maskValue('ab')).toBe('****');
    expect(maskValue('abcd1234')).toBe('****');
    expect(maskValue('123456789012')).toBe('****');
    expect(maskValue('my-secret-api-key-xY3Q')).toBe('****');
  });
});

describe('buildPrompt', () => {
  it('shows default in plain text when not sensitive', () => {
    expect(buildPrompt('Username', 'elastic')).toBe('Username [elastic]: ');
  });

  it('masks default when sensitive', () => {
    expect(buildPrompt('API Key', 'super-secret-key-xY3Q', true)).toBe('API Key [****]: ');
  });

  it('shows no default when value is empty', () => {
    expect(buildPrompt('API Key', '', true)).toBe('API Key: ');
  });

  it('shows no default when value is undefined', () => {
    expect(buildPrompt('API Key')).toBe('API Key: ');
    expect(buildPrompt('API Key', undefined, true)).toBe('API Key: ');
  });

  describe('password prompt', () => {
    // Mirrors the logic in setup.ts:
    //   const savedPassword = existing.ES_PASSWORD;
    //   esPassword = await ask('Password', savedPassword || 'changeme', !!savedPassword);

    it('shows changeme in clear text when no saved password', () => {
      const savedPassword = undefined;
      expect(buildPrompt('Password', savedPassword || 'changeme', !!savedPassword)).toBe(
        'Password [changeme]: '
      );
    });

    it('masks when saved password is changeme', () => {
      const savedPassword = 'changeme';
      expect(buildPrompt('Password', savedPassword || 'changeme', !!savedPassword)).toBe(
        'Password [****]: '
      );
    });

    it('masks when saved password is a custom value', () => {
      const savedPassword = 'my-super-secret-pw';
      expect(buildPrompt('Password', savedPassword || 'changeme', !!savedPassword)).toBe(
        'Password [****]: '
      );
    });
  });
});
