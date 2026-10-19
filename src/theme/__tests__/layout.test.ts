import { computeLayout, scaled } from '../layout';

describe('computeLayout', () => {
  it('uses scale 1 on the 390dp baseline', () => {
    const l = computeLayout(390);
    expect(l.scale).toBe(1);
    expect(l.isCompact).toBe(false);
    expect(l.gutter).toBe(16);
  });

  it('flags narrow phones as compact with tighter gutters', () => {
    const l = computeLayout(320);
    expect(l.isCompact).toBe(true);
    expect(l.gutter).toBe(12);
  });

  it('clamps scale so tiny and huge screens stay legible', () => {
    expect(computeLayout(200).scale).toBe(0.88);
    expect(computeLayout(1200).scale).toBe(1.15);
  });

  it('widens gutters on large screens but caps content width', () => {
    const l = computeLayout(900);
    expect(l.gutter).toBe(24);
    expect(l.maxContentWidth).toBe(560);
  });

  it.each([0, -10, NaN, Infinity * 0])('falls back to baseline for invalid width %p', (w) => {
    expect(computeLayout(w).scale).toBe(1);
  });
});

describe('scaled', () => {
  it('rounds to whole dp', () => {
    expect(scaled(computeLayout(360), 28)).toBe(Math.round(28 * (360 / 390)));
  });
});
