/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { columnarToRows, describeColumns, validateFields } from './esql-transform.js';

describe('columnarToRows', () => {
  it('transforms columnar response to row objects', () => {
    const response = {
      columns: [
        { name: 'category', type: 'keyword' },
        { name: 'count', type: 'long' },
      ],
      values: [
        ['shoes', 10],
        ['hats', 5],
        ['bags', 3],
      ],
    };
    expect(columnarToRows(response)).toEqual([
      { category: 'shoes', count: 10 },
      { category: 'hats', count: 5 },
      { category: 'bags', count: 3 },
    ]);
  });

  it('returns empty array for empty values', () => {
    const response = {
      columns: [{ name: 'x', type: 'keyword' }],
      values: [],
    };
    expect(columnarToRows(response)).toEqual([]);
  });

  it('handles single row', () => {
    const response = {
      columns: [{ name: 'total', type: 'long' }],
      values: [[42]],
    };
    expect(columnarToRows(response)).toEqual([{ total: 42 }]);
  });
});

describe('describeColumns', () => {
  it('extracts name and type from columns', () => {
    const response = {
      columns: [
        { name: 'host', type: 'keyword' },
        { name: 'bytes', type: 'long' },
      ],
      values: [],
    };
    expect(describeColumns(response)).toEqual([
      { name: 'host', type: 'keyword' },
      { name: 'bytes', type: 'long' },
    ]);
  });
});

describe('validateFields', () => {
  const data = [{ category: 'shoes', count: 10, price: 99.9 }];

  it('returns null when all fields exist', () => {
    expect(validateFields(data, ['category', 'count'])).toBeNull();
  });

  it('returns error listing missing fields', () => {
    const result = validateFields(data, ['category', 'missing_field']);
    expect(result).toContain('missing_field');
    expect(result).toContain('Available fields');
  });

  it('returns error for all missing fields', () => {
    const result = validateFields(data, ['foo', 'bar']);
    expect(result).toContain('foo');
    expect(result).toContain('bar');
  });
});
