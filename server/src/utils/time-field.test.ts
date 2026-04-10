/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { pickTimeField } from './time-field.js';

describe('pickTimeField', () => {
  it('returns @timestamp when present', () => {
    expect(pickTimeField(['order_date', '@timestamp', 'created_at'])).toBe('@timestamp');
  });

  it('returns timestamp when @timestamp is absent', () => {
    expect(pickTimeField(['order_date', 'timestamp', 'created_at'])).toBe('timestamp');
  });

  it('returns first field when neither @timestamp nor timestamp', () => {
    expect(pickTimeField(['order_date', 'created_at'])).toBe('order_date');
  });

  it('returns undefined for empty array', () => {
    expect(pickTimeField([])).toBeUndefined();
  });
});
