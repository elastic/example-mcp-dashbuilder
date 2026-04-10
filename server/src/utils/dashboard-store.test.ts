/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { slugify } from './dashboard-store.js';

describe('slugify', () => {
  it('converts title to lowercase slug', () => {
    expect(slugify('My Cool Dashboard')).toBe('my-cool-dashboard');
  });

  it('strips special characters', () => {
    expect(slugify('Sales & Revenue!!!')).toBe('sales-revenue');
  });

  it('returns untitled for empty string', () => {
    expect(slugify('')).toBe('untitled');
  });

  it('returns untitled for all special characters', () => {
    expect(slugify('!!!')).toBe('untitled');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello');
  });
});
