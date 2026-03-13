import { describe, it, expect } from 'vitest';
import { formatUGXShort } from './formatUtils';

describe('formatUGXShort', () => {
  it('handles sub-1K values', () => {
    expect(formatUGXShort(850)).toBe('UGX 850');
  });

  it('handles exact 1K', () => {
    expect(formatUGXShort(1000)).toBe('UGX 1K');
  });

  it('handles 85K', () => {
    expect(formatUGXShort(85000)).toBe('UGX 85K');
  });

  it('handles 850K', () => {
    expect(formatUGXShort(850000)).toBe('UGX 850K');
  });

  it('handles exact 1M', () => {
    expect(formatUGXShort(1000000)).toBe('UGX 1M');
  });

  it('handles 1.2M', () => {
    expect(formatUGXShort(1200000)).toBe('UGX 1.2M');
  });

  it('handles 28.5M', () => {
    expect(formatUGXShort(28500000)).toBe('UGX 28.5M');
  });

  it('handles 100M', () => {
    expect(formatUGXShort(100000000)).toBe('UGX 100M');
  });

  it('drops trailing .0', () => {
    expect(formatUGXShort(2000000)).toBe('UGX 2M');
  });

  it('handles negatives', () => {
    expect(formatUGXShort(-1800000)).toBe('−UGX 1.8M');
  });

  it('handles zero', () => {
    expect(formatUGXShort(0)).toBe('UGX 0');
  });
});

