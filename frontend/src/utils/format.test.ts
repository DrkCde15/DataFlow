import { describe, expect, it } from 'vitest';
import { formatBytes, formatUpdatedAt } from './format';

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(35841)).toBe('35.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(Math.round(2.5 * 1024 * 1024))).toBe('2.5 MB');
  });
});

describe('formatUpdatedAt', () => {
  it('returns a non-empty localized string', () => {
    const formatted = formatUpdatedAt('2026-09-24T14:30:39.731211+00:00');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
