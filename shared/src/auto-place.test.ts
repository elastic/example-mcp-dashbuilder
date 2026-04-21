/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { describe, expect, it } from 'vitest';
import { autoPlacePanels, buildBalancedRowWidths } from './auto-place.js';

describe('buildBalancedRowWidths', () => {
  it('distributes evenly when divisible', () => {
    expect(buildBalancedRowWidths(2, 48)).toEqual([24, 24]);
  });

  it('gives remainder to earlier panels', () => {
    expect(buildBalancedRowWidths(3, 48)).toEqual([16, 16, 16]);
    expect(buildBalancedRowWidths(5, 48)).toEqual([10, 10, 10, 9, 9]);
  });
});

describe('autoPlacePanels', () => {
  it('places a single bar chart spanning the full row', () => {
    const { placements, nextRow } = autoPlacePanels([{ id: 'b1', chartType: 'bar' }]);
    expect(placements).toEqual([{ id: 'b1', x: 0, y: 0, w: 48, h: 15 }]);
    expect(nextRow).toBe(15);
  });

  it('places two half-width charts on one row', () => {
    const { placements } = autoPlacePanels([
      { id: 'b1', chartType: 'bar' },
      { id: 'b2', chartType: 'bar' },
    ]);
    expect(placements).toEqual([
      { id: 'b1', x: 0, y: 0, w: 24, h: 15 },
      { id: 'b2', x: 24, y: 0, w: 24, h: 15 },
    ]);
  });

  it('wraps to a new row when width exceeds column count', () => {
    const { placements, nextRow } = autoPlacePanels([
      { id: 'b1', chartType: 'bar' },
      { id: 'b2', chartType: 'bar' },
      { id: 'b3', chartType: 'bar' },
    ]);
    expect(placements[0]).toMatchObject({ id: 'b1', y: 0 });
    expect(placements[1]).toMatchObject({ id: 'b2', y: 0 });
    expect(placements[2]).toMatchObject({ id: 'b3', y: 15, w: 48 });
    expect(nextRow).toBe(30);
  });

  it('respects startRow offset', () => {
    const { placements } = autoPlacePanels([{ id: 'b1', chartType: 'bar' }], 10);
    expect(placements[0]).toMatchObject({ y: 10 });
  });

  it('handles metrics (quarter-width)', () => {
    const panels = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, chartType: 'metric' }));
    const { placements, nextRow } = autoPlacePanels(panels);
    expect(placements.map((p) => p.w)).toEqual([12, 12, 12, 12]);
    expect(nextRow).toBe(10);
  });
});
