import { useEffect } from 'react';
import { useStoredChoice } from '../../hooks/useStoredChoice';
import { THEME_STORAGE_KEY, THEMES, resolveInitialTheme, toggleTheme } from './theme';

function systemTheme() {
  return resolveInitialTheme(null, window.matchMedia('(prefers-color-scheme: light)').matches);
}

export function useTheme() {
  const [theme, setTheme] = useStoredChoice(THEME_STORAGE_KEY, THEMES, systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return { theme, toggle: () => setTheme(toggleTheme(theme)) };
}
