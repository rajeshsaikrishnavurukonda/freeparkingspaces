import { useMemo } from 'react';
import { isApplePlatform } from '../models/platform/detectPlatform';

export function useIsApplePlatform(): boolean {
  return useMemo(() => isApplePlatform(), []);
}
