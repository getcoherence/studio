export const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '4:5', '16:10', '10:16', 'native'] as const;

export type AspectRatio = typeof ASPECT_RATIOS[number];

/**
 * Returns the numeric value of an aspect ratio.
 * For 'native', returns a fallback of 16/9 — callers with video/crop info
 * should use getNativeAspectRatioValue() instead.
 */
export function getAspectRatioValue(aspectRatio: AspectRatio): number {
  switch (aspectRatio) {
    case '16:9': return 16 / 9;
    case '9:16': return 9 / 16;
    case '1:1':  return 1;
    case '4:3':  return 4 / 3;
    case '4:5':  return 4 / 5;
    case '16:10': return 16 / 10;
    case '10:16': return 10 / 16;
    case 'native': return 16 / 9;
    default: {
      const _exhaustiveCheck: never = aspectRatio;
      return _exhaustiveCheck;
    }
  }
}

/**
 * Returns the aspect ratio value for 'native' mode based on the cropped video dimensions.
 */
export function getNativeAspectRatioValue(
  videoWidth: number,
  videoHeight: number,
  cropRegion?: { x: number; y: number; width: number; height: number },
): number {
  const cropW = cropRegion?.width ?? 1;
  const cropH = cropRegion?.height ?? 1;
  return (videoWidth * cropW) / (videoHeight * cropH);
}

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

export function getAspectRatioLabel(aspectRatio: AspectRatio): string {
  if (aspectRatio === 'native') return 'Native';
  return aspectRatio;
}


export function formatAspectRatioForCSS(aspectRatio: AspectRatio, nativeRatio?: number): string {
  if (aspectRatio === 'native') return String(nativeRatio ?? 16 / 9);
  return aspectRatio.replace(':', '/');
}
