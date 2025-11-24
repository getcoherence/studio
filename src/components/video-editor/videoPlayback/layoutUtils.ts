import { Application, Sprite, Graphics } from 'pixi.js';
import { VIEWPORT_SCALE } from "./constants";
import type { CropRegion } from '../types';

interface LayoutParams {
  container: HTMLDivElement;
  app: Application;
  videoSprite: Sprite;
  maskGraphics: Graphics;
  videoElement: HTMLVideoElement;
  cropRegion?: CropRegion;
  lockedVideoDimensions?: { width: number; height: number } | null;
}

interface LayoutResult {
  stageSize: { width: number; height: number };
  videoSize: { width: number; height: number };
  baseScale: number;
  baseOffset: { x: number; y: number };
  maskRect: { x: number; y: number; width: number; height: number };
  cropBounds: { startX: number; endX: number; startY: number; endY: number };
}

export function layoutVideoContent(params: LayoutParams): LayoutResult | null {
  const { container, app, videoSprite, maskGraphics, videoElement, cropRegion, lockedVideoDimensions } = params;


  const videoWidth = lockedVideoDimensions?.width || videoElement.videoWidth;
  const videoHeight = lockedVideoDimensions?.height || videoElement.videoHeight;

  if (!videoWidth || !videoHeight) {
    return null;
  }

  const width = container.clientWidth;
  const height = container.clientHeight;

  if (!width || !height) {
    return null;
  }

  app.renderer.resize(width, height);
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';

  // Apply crop region
  const crop = cropRegion || { x: 0, y: 0, width: 1, height: 1 };
  
  // Calculate the cropped dimensions
  const croppedVideoWidth = videoWidth * crop.width;
  const croppedVideoHeight = videoHeight * crop.height;

  const cropStartX = crop.x * videoWidth;
  const cropStartY = crop.y * videoHeight;
  const cropEndX = cropStartX + croppedVideoWidth;
  const cropEndY = cropStartY + croppedVideoHeight;
  
  // Calculate scale to fit the cropped area in the viewport
  const maxDisplayWidth = width * VIEWPORT_SCALE;
  const maxDisplayHeight = height * VIEWPORT_SCALE;

  const scale = Math.min(
    maxDisplayWidth / croppedVideoWidth,
    maxDisplayHeight / croppedVideoHeight,
    1
  );

  videoSprite.scale.set(scale);
  
  // Calculate display size of the full video at this scale
  const fullVideoDisplayWidth = videoWidth * scale;
  const fullVideoDisplayHeight = videoHeight * scale;
  
  // Calculate display size of just the cropped region
  const croppedDisplayWidth = croppedVideoWidth * scale;
  const croppedDisplayHeight = croppedVideoHeight * scale;

  // Center the cropped region in the container
  const centerOffsetX = (width - croppedDisplayWidth) / 2;
  const centerOffsetY = (height - croppedDisplayHeight) / 2;
  
  // Position the full video sprite so that when we apply the mask,
  // the cropped region appears centered
  // The crop starts at (crop.x * videoWidth, crop.y * videoHeight) in video coordinates
  // In display coordinates, that's (crop.x * fullVideoDisplayWidth, crop.y * fullVideoDisplayHeight)
  // We want that point to be at centerOffsetX, centerOffsetY
  const spriteX = centerOffsetX - (crop.x * fullVideoDisplayWidth);
  const spriteY = centerOffsetY - (crop.y * fullVideoDisplayHeight);
  
  videoSprite.position.set(spriteX, spriteY);

  // Create a mask that only shows the cropped region (centered in container)
  const maskX = centerOffsetX;
  const maskY = centerOffsetY;
  const radius = Math.min(croppedDisplayWidth, croppedDisplayHeight) * 0.02;
  maskGraphics.clear();
  maskGraphics.roundRect(maskX, maskY, croppedDisplayWidth, croppedDisplayHeight, radius);
  maskGraphics.fill({ color: 0xffffff });

  return {
    stageSize: { width, height },
    videoSize: { width: croppedVideoWidth, height: croppedVideoHeight },
    baseScale: scale,
    baseOffset: { x: spriteX, y: spriteY },
    maskRect: { x: maskX, y: maskY, width: croppedDisplayWidth, height: croppedDisplayHeight },
    cropBounds: { startX: cropStartX, endX: cropEndX, startY: cropStartY, endY: cropEndY },
  };
}
