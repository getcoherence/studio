export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

/**
 * Converts aspect ratio string to numeric value
 * @param aspectRatio - Aspect ratio as string (e.g., '16:9')
 * @returns Numeric aspect ratio value (e.g., 1.777... for 16:9)
 */
export function getAspectRatioValue(aspectRatio: AspectRatio): number {
  switch (aspectRatio) {
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    case '1:1':
      return 1;
    case '4:3':
      return 4 / 3;
  }
}

/**
 * Calculates dimensions for a given aspect ratio based on a base width
 * @param aspectRatio - Aspect ratio as string
 * @param baseWidth - Base width to calculate from
 * @returns Object with width and height
 */
export function getAspectRatioDimensions(
  aspectRatio: AspectRatio,
  baseWidth: number
): { width: number; height: number } {
  const ratio = getAspectRatioValue(aspectRatio);
  return {
    width: baseWidth,
    height: baseWidth / ratio,
  };
}

/**
 * Formats aspect ratio for CSS
 * @param aspectRatio - Aspect ratio as string
 * @returns CSS-compatible aspect ratio string
 */
export function formatAspectRatioForCSS(aspectRatio: AspectRatio): string {
  return aspectRatio.replace(':', '/');
}
