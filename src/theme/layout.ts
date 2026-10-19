/**
 * Pure responsive-layout rules (no React) so they can be unit tested.
 * Design baseline is a 390dp-wide phone.
 */
const BASE_WIDTH = 390;
const COMPACT_WIDTH = 360;
const MAX_CONTENT_WIDTH = 560;

export interface Layout {
  width: number;
  /** Narrow phones (< 360dp): tighter spacing and slightly smaller type. */
  isCompact: boolean;
  /** Multiplier applied to sizes. Clamped so tiny/huge screens stay legible. */
  scale: number;
  /** Horizontal page padding. */
  gutter: number;
  /** Content never grows wider than this (tablets, foldables, landscape). */
  maxContentWidth: number;
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

export function computeLayout(width: number): Layout {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : BASE_WIDTH;
  const scale = clamp(safeWidth / BASE_WIDTH, 0.88, 1.15);
  const isCompact = safeWidth < COMPACT_WIDTH;
  return {
    width: safeWidth,
    isCompact,
    scale,
    gutter: isCompact ? 12 : safeWidth >= 600 ? 24 : 16,
    maxContentWidth: MAX_CONTENT_WIDTH,
  };
}

/** Scale a size for the current screen, rounded to a whole dp. */
export function scaled(layout: Layout, size: number): number {
  return Math.round(size * layout.scale);
}
