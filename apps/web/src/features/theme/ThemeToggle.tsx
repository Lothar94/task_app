import { Moon, Sun } from 'lucide-react';
import { IconButton } from '../../components/ui';
import { useTheme } from './useTheme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Activar modo día' : 'Activar modo noche';
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <IconButton label={label} onClick={toggle} className="size-8">
      <Icon aria-hidden className="size-[18px]" />
    </IconButton>
  );
}
