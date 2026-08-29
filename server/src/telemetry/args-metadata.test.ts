/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, it, expect } from 'vitest';
import { buildArgsMetadata } from './args-metadata.js';

describe('buildArgsMetadata', () => {
  it('records string length only', () => {
    expect(
      buildArgsMetadata({
        query: 'SECRET FROM x',
        title: 'hi',
      })
    ).toEqual({
      query: { kind: 'string', len: 13 },
      title: { kind: 'string', len: 2 },
    });
  });

  it('summarizes mixed shapes', () => {
    expect(
      buildArgsMetadata({
        n: 1,
        f: true,
        a: [1, 2],
        o: { a: 1 },
      })
    ).toEqual({
      n: { kind: 'number' },
      f: { kind: 'boolean' },
      a: { kind: 'array', len: 2 },
      o: { kind: 'object', keys: 1 },
    });
  });
});
