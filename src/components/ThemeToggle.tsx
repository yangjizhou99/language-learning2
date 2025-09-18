'use client';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (theme ?? resolvedTheme) === 'dark';
  const toggle = () => setTheme(isDark ? 'light' : 'dark');
  return (
    <Button variant="ghost" onClick={toggle} aria-label="切换主题">
      {isDark ? '🌙' : '☀️'}
    </Button>
  );
}
