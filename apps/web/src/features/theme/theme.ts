export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

// Keep in sync with the inline script in index.html, which applies the theme before first paint.
export const THEME_STORAGE_KEY = 'fleet.theme';

export function resolveInitialTheme(stored: string | null, prefersLight: boolean): Theme {
  const saved = THEMES.find((theme) => theme === stored);
  if (saved) return saved;
  return prefersLight ? 'light' : 'dark';
}

export function toggleTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
