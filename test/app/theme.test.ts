import { describe, it, expect } from 'vitest';
import { theme } from '@/lib/theme';

describe('theme', () => {
  it('is a dark MUI theme', () => {
    expect(theme.palette.mode).toBe('dark');
  });
});
