import { atom } from 'nanostores';

export type Theme = 'light' | 'dark' | 'white';

export const $theme = atom<Theme>(
  (typeof localStorage !== 'undefined' && localStorage.getItem('theme') as Theme) || 'light'
);

export function cycleTheme() {
  const order: Theme[] = ['light', 'dark', 'white'];
  const current = order.indexOf($theme.get());
  const next = order[(current + 1) % order.length];
  $theme.set(next);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('theme', next);
  }
}
