import { describe, expect, it } from 'vitest';
import { resolveInitialTheme, toggleTheme } from './theme';

describe('resolveInitialTheme', () => {
  it('prefers a valid stored theme over the system preference', () => {
    expect(resolveInitialTheme('light', false)).toBe('light');
    expect(resolveInitialTheme('dark', true)).toBe('dark');
  });

  it('falls back to the system preference when nothing valid is stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('light');
    expect(resolveInitialTheme('sepia', true)).toBe('light');
  });

  it('defaults to dark', () => {
    expect(resolveInitialTheme(null, false)).toBe('dark');
    expect(resolveInitialTheme('sepia', false)).toBe('dark');
  });
});

describe('toggleTheme', () => {
  it('switches between light and dark', () => {
    expect(toggleTheme('dark')).toBe('light');
    expect(toggleTheme('light')).toBe('dark');
  });
});
