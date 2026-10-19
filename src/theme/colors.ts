export type Palette = {
  bg: string;
  bgElevated: string;
  bgCard: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  silver: string;
  silverBright: string;
  accent: string;
  danger: string;
  success: string;
  warning: string;
  overlay: string;
  /** Primary button fill. Dark mode is silver; light mode is near-black so it stays visible. */
  buttonBg: string;
  buttonText: string;
};

export const darkColors: Palette = {
  bg: '#0A0A0A',
  bgElevated: '#141414',
  bgCard: '#1A1A1A',
  border: '#2A2A2A',
  text: '#F5F5F5',
  textMuted: '#9A9A9A',
  textDim: '#6B6B6B',
  silver: '#C8CCD0',
  silverBright: '#E8EAEB',
  accent: '#D0D4D8',
  danger: '#E85D5D',
  success: '#5DCF8B',
  warning: '#E8B85D',
  overlay: 'rgba(0,0,0,0.65)',
  buttonBg: '#E8EAEB',
  buttonText: '#0A0A0A',
};

export const lightColors: Palette = {
  bg: '#F4F5F7',
  bgElevated: '#FFFFFF',
  bgCard: '#FFFFFF',
  border: '#E2E4E8',
  text: '#1A1A1A',
  textMuted: '#5C6168',
  textDim: '#8A9098',
  silver: '#3A3F46',
  silverBright: '#1A1A1A',
  accent: '#2C3138',
  danger: '#E85D5D',
  success: '#5DCF8B',
  warning: '#E8B85D',
  overlay: 'rgba(0,0,0,0.4)',
  buttonBg: '#1A1A1A',
  buttonText: '#F5F5F5',
};

/** Kept for modules that are not on a screen (status colours). Screens should call useColors(). */
export const colors = darkColors;

/** One accent colour per section so the app is easy to scan. These stay the same in both themes. */
export const sectionColors = {
  projects: '#6AA9FF',
  tasks: '#B58CFF',
  expenses: '#FFB547',
  team: '#4FD1A5',
  home: '#E8EAEB',
  billing: '#5DCF8B',
  pending: '#FF8A5B',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
};

/** Translucent tint of a hex colour, used for icon bubbles and badges. */
export function tint(hex: string, alpha = 0.16): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
