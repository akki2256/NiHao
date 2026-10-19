import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { computeLayout, Layout, scaled } from './layout';

export function useLayout(): Layout & { s: (size: number) => number } {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const layout = computeLayout(width);
    return { ...layout, s: (size: number) => scaled(layout, size) };
  }, [width]);
}
