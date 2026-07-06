const APPLE_UA_PATTERN = /iPhone|iPad|iPod|Macintosh/i;

/**
 * True for iOS/iPadOS/macOS (Safari, or any browser on those platforms).
 * Accepts an explicit userAgent for testability; defaults to the real one.
 */
export function isApplePlatform(userAgent: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return APPLE_UA_PATTERN.test(userAgent);
}
