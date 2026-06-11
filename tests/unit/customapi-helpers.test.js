import {
  describe, it, expect, beforeEach, afterEach, vi,
} from 'vitest';
import { resolveField, formatValue, adaptiveColor } from '@/utils/CustomApiHelpers';

describe('CustomApiHelpers - resolveField', () => {
  it('resolves a nested dot-path', () => {
    expect(resolveField({ a: { b: 1 } }, 'a.b')).toBe(1);
  });

  it('resolves array indices in the path', () => {
    expect(resolveField({ a: [{ n: 'x' }] }, 'a.0.n')).toBe('x');
  });

  it('returns undefined for a missing path without throwing', () => {
    expect(resolveField({ a: 1 }, 'a.b.c')).toBeUndefined();
  });

  it('returns the root when path is omitted', () => {
    expect(resolveField('scalar')).toBe('scalar');
  });

  it('returns null when the object is null', () => {
    expect(resolveField(null, 'a')).toBeNull();
  });
});

describe('CustomApiHelpers - formatValue', () => {
  it('text: null becomes an empty string', () => {
    expect(formatValue(null, { format: 'text' })).toBe('');
  });

  it('text: coerces to string', () => {
    expect(formatValue(5, { format: 'text' })).toBe('5');
  });

  it('number: formats with grouping', () => {
    expect(formatValue(1234, { format: 'number', locale: 'en-US' })).toBe('1,234');
  });

  it('number: passes through non-numeric input', () => {
    expect(formatValue('abc', { format: 'number', locale: 'en-US' })).toBe('abc');
  });

  it('percent: treats the value as an already-computed percentage', () => {
    expect(formatValue(42, { format: 'percent', locale: 'en-US' })).toBe('42%');
  });

  it('date: formats a valid date', () => {
    const out = formatValue('2026-06-10', { format: 'date', dateStyle: 'long', locale: 'en-US' });
    expect(out).toMatch(/2026/);
  });

  it('date: passes through an invalid date', () => {
    expect(formatValue('notadate', { format: 'date', locale: 'en-US' })).toBe('notadate');
  });

  it('size: counts array elements (root when field omitted)', () => {
    expect(formatValue([1, 2, 3], { format: 'size' }, [1, 2, 3])).toBe('3');
  });

  it('size: counts object keys', () => {
    expect(formatValue({ a: 1, b: 2 }, { format: 'size' }, { a: 1, b: 2 })).toBe('2');
  });
});

describe('CustomApiHelpers - adaptiveColor', () => {
  it('returns success for a positive value', () => {
    expect(adaptiveColor(5)).toBe('success');
  });
  it('returns error for a negative value', () => {
    expect(adaptiveColor(-2.4)).toBe('error');
  });
  it('returns info for zero', () => {
    expect(adaptiveColor(0)).toBe('info');
  });
  it('returns no colour for non-numeric input', () => {
    expect(adaptiveColor('online')).toBe('');
  });
});

describe('CustomApiHelpers - relativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-10T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats a past date', () => {
    const out = formatValue('2026-06-08T00:00:00Z', { format: 'relativeDate', locale: 'en-US' });
    expect(out).toBe('2 days ago');
  });

  it('formats a future date', () => {
    const out = formatValue('2026-06-13T00:00:00Z', { format: 'relativeDate', locale: 'en-US' });
    expect(out).toBe('in 3 days');
  });
});
