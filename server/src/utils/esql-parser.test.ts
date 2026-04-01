import { describe, it, expect } from 'vitest';
import { parseIndexPattern } from './esql-parser.js';

describe('parseIndexPattern', () => {
  it('extracts index from simple FROM', () => {
    expect(parseIndexPattern('FROM logs-*')).toBe('logs-*');
  });

  it('extracts index from FROM with pipes', () => {
    expect(parseIndexPattern('FROM kibana_sample_data_logs | STATS count = COUNT(*)')).toBe(
      'kibana_sample_data_logs'
    );
  });

  it('extracts multiple comma-separated indices', () => {
    expect(parseIndexPattern('FROM index1, index2')).toBe('index1,index2');
  });

  it('handles TS command', () => {
    expect(parseIndexPattern('TS metrics')).toBe('metrics');
  });

  it('returns undefined for query without FROM/TS', () => {
    expect(parseIndexPattern('ROW x = 1')).toBeUndefined();
  });

  it('returns undefined for malformed query', () => {
    expect(parseIndexPattern('not a query at all!!!')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(parseIndexPattern('')).toBeUndefined();
  });
});
