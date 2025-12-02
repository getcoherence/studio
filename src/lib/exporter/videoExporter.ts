import type { ExportConfig, ExportProgress, ExportResult } from './types';
import { VideoFileDecoder } from './videoDecoder';
import { FrameRenderer } from './frameRenderer';
import { VideoMuxer } from './muxer';
import type { ZoomRegion, CropRegion, TrimRegion, AnnotationRegion } from '@/components/video-editor/types';

interface VideoExporterConfig extends ExportConfig {
  videoUrl: string;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  trimRegions?: TrimRegion[];
  showShadow: boolean;
  shadowIntensity: number;
  showBlur: boolean;
  motionBlurEnabled?: boolean;
  borderRadius?: number;
  padding?: number;
  videoPadding?: number;
  cropRegion: CropRegion;
  annotationRegions?: AnnotationRegion[];
  previewWidth?: number;
  previewHeight?: number;
  onProgress?: (progress: ExportProgress) => void;
}

export class VideoExporter {
  private config: VideoExporterConfig;
  private decoder: VideoFileDecoder | null = null;
  private renderer: FrameRenderer | null = null;
  private encoder: VideoEncoder | null = null;
  private muxer: VideoMuxer | null = null;
  private cancelled = false;
  private encodeQueue = 0;
  private readonly MAX_ENCODE_QUEUE = 120;
  private videoDescription: Uint8Array | undefined;
  private videoColorSpace: VideoColorSpaceInit | undefined;
  private muxingPromises: Promise<void>[] = [];
  private chunkCount = 0;

  constructor(config: VideoExporterConfig) {
    this.config = config;
  }

  // Calculate the total duration excluding trim regions (in seconds)
  private getEffectiveDuration(totalDuration: number): number {
    const trimRegions = this.config.trimRegions || [];
    const totalTrimDuration = trimRegions.reduce((sum, region) => {
      return sum + (region.endMs - region.startMs) / 1000;
    }, 0);
    return totalDuration - totalTrimDuration;
  }

  private mapEffectiveToSourceTime(effectiveTimeMs: number): number {
    const trimRegions = this.config.trimRegions || [];
    // Sort trim regions by start time
    const sortedTrims = [...trimRegions].sort((a, b) => a.startMs - b.startMs);
    
    let sourceTimeMs = effectiveTimeMs;
    
    for (const trim of sortedTrims) {
      // If the source time hasn't reached this trim region yet, we're done
      if (sourceTimeMs < trim.startMs) {
        break;
      }
      
      // Add the duration of this trim region to the source time
      const trimDuration = trim.endMs - trim.startMs;
      sourceTimeMs += trimDuration;
    }
    
    return sourceTimeMs;
  }

  async export(): Promise<ExportResult> {
    try {
      this.cleanup();
      this.cancelled = false;
      
      const exportStartTime = performance.now();

      this.decoder = new VideoFileDecoder();
      const videoInfo = await this.decoder.loadVideo(this.config.videoUrl);

      this.renderer = new FrameRenderer({
        width: this.config.width,
        height: this.config.height,
        wallpaper: this.config.wallpaper,
        zoomRegions: this.config.zoomRegions,
        showShadow: this.config.showShadow,
        shadowIntensity: this.config.shadowIntensity,
        showBlur: this.config.showBlur,
        motionBlurEnabled: this.config.motionBlurEnabled,
        borderRadius: this.config.borderRadius,
        padding: this.config.padding,
        cropRegion: this.config.cropRegion,
        videoWidth: videoInfo.width,
        videoHeight: videoInfo.height,
        annotationRegions: this.config.annotationRegions,
        previewWidth: this.config.previewWidth,
        previewHeight: this.config.previewHeight,
      });
      await this.renderer.initialize();

      await this.initializeEncoder();
      this.muxer = new VideoMuxer(this.config, false);
      await this.muxer.initialize();

      const videoElement = this.decoder.getVideoElement();
      if (!videoElement) {
        throw new Error('Video element not available');
      }

      // Calculate frame count after trimming
      const effectiveDuration = this.getEffectiveDuration(videoInfo.duration);
      const totalFrames = Math.ceil(effectiveDuration * this.config.frameRate);
      const frameDuration = 1_000_000 / this.config.frameRate;
      const timeStep = 1 / this.config.frameRate;

      videoElement.muted = true;
      if (videoElement.readyState < 2) {
        await new Promise<void>(r => {
          videoElement.addEventListener('loadeddata', () => r(), { once: true });
        });
      }

      // Pipeline: Decode 10 frames ahead to overlap decode/render/encode operations
      const DECODE_AHEAD = 10;
      const frameQueue: { frame: VideoFrame; timestamp: number; sourceTimestamp: number }[] = [];
      
      // Decode a single frame from source video
      const decodeFrame = async (idx: number) => {
        if (idx >= totalFrames) return;
        
        const timestamp = idx * frameDuration;
        const effectiveTimeMs = (idx * timeStep) * 1000;
        const sourceTimeMs = this.mapEffectiveToSourceTime(effectiveTimeMs);
        const videoTime = sourceTimeMs / 1000;
        const sourceTimestamp = sourceTimeMs * 1000;
        
        // Seek to frame position
        const needsSeek = Math.abs(videoElement.currentTime - videoTime) > 0.001;
        if (needsSeek || idx === 0) {
          videoElement.currentTime = videoTime;
          await new Promise<void>(r => { 
            videoElement.addEventListener('seeked', () => r(), { once: true }); 
          });
        }

        // Create VideoFrame from current video element position
        const videoFrame = new VideoFrame(videoElement, { timestamp });
        frameQueue.push({ frame: videoFrame, timestamp, sourceTimestamp });
      };
      
      // Pre-decode first batch of frames
      for (let i = 0; i < Math.min(DECODE_AHEAD, totalFrames); i++) {
        await decodeFrame(i);
      }
      
      let frameIndex = 0;
      let decodeIndex = DECODE_AHEAD;
      
      // Main processing loop
      while (frameIndex < totalFrames && !this.cancelled) {
        // Wait for decoded frame to be available
        while (frameQueue.length === 0 && frameIndex < totalFrames) {
          await new Promise(r => setTimeout(r, 1));
        }
        
        if (frameQueue.length === 0) break;
        
        const { frame: videoFrame, timestamp, sourceTimestamp } = frameQueue.shift()!;

        // Render frame with effects using PixiJS
        await this.renderer!.renderFrame(videoFrame, sourceTimestamp);
        videoFrame.close();

        // Create VideoFrame directly from canvas (GPU-level)
        const canvas = this.renderer!.getCanvas();
        // @ts-ignore
        const exportFrame = new VideoFrame(canvas, {
          timestamp,
          duration: frameDuration,
          colorSpace: {
            primaries: 'bt709',
            transfer: 'iec61966-2-1',
            matrix: 'rgb',
            fullRange: true,
          },
        });

        // Wait if encoder queue is full
        while (this.encodeQueue >= this.MAX_ENCODE_QUEUE && !this.cancelled) {
          await new Promise(r => setTimeout(r, 0));
        }

        // Encode frame using hardware acceleration
        if (this.encoder && this.encoder.state === 'configured') {
          this.encodeQueue++;
          this.encoder.encode(exportFrame, { keyFrame: frameIndex % 150 === 0 });
        }
        
        exportFrame.close();
        frameIndex++;
        
        // Decode next frame in parallel while we process current frame
        if (decodeIndex < totalFrames) {
          decodeFrame(decodeIndex++).catch(e => console.error('[VideoExporter] Decode error:', e));
        }


        if (this.config.onProgress) {
          this.config.onProgress({
            currentFrame: frameIndex,
            totalFrames,
            percentage: (frameIndex / totalFrames) * 100,
            estimatedTimeRemaining: 0,
          });
        }
      }

      if (this.cancelled) {
        return { success: false, error: 'Export cancelled' };
      }

      if (this.encoder && this.encoder.state === 'configured') {
        await this.encoder.flush();
      }
      await Promise.all(this.muxingPromises);
      const blob = await this.muxer!.finalize();
      
      const totalTime = performance.now() - exportStartTime;
      console.log(`[VideoExporter] Export complete in ${(totalTime/1000).toFixed(2)}s (${totalFrames} frames)`);

      return { success: true, blob };
    } catch (error) {
      console.error('[VideoExporter] Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.cleanup();
    }
  }

  private async initializeEncoder(): Promise<void> {
    this.encodeQueue = 0;
    this.muxingPromises = [];
    this.chunkCount = 0;

    // Create VideoEncoder with hardware acceleration
    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        // Capture codec description and color space from first chunk
        if (meta?.decoderConfig?.description && !this.videoDescription) {
          const desc = meta.decoderConfig.description;
          this.videoDescription = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as any));
        }
        if (meta?.decoderConfig?.colorSpace && !this.videoColorSpace) {
          this.videoColorSpace = meta.decoderConfig.colorSpace;
        }
        
        const isFirstChunk = this.chunkCount === 0;
        this.chunkCount++;
        
        // Send encoded chunk to muxer
        const muxingPromise = (async () => {
          try {
            if (isFirstChunk && this.videoDescription) {
              const colorSpace = this.videoColorSpace || {
                primaries: 'bt709',
                transfer: 'iec61966-2-1',
                matrix: 'rgb',
                fullRange: true,
              };
              
              const metadata: EncodedVideoChunkMetadata = {
                decoderConfig: {
                  codec: this.config.codec || 'avc1.640033',
                  codedWidth: this.config.width,
                  codedHeight: this.config.height,
                  description: this.videoDescription,
                  colorSpace,
                },
              };
              
              await this.muxer!.addVideoChunk(chunk, metadata);
            } else {
              await this.muxer!.addVideoChunk(chunk, meta);
            }
          } catch (error) {
            console.error('[VideoExporter] Muxing error:', error);
          }
        })();
        
        this.muxingPromises.push(muxingPromise);
        this.encodeQueue--;
      },
      error: (error) => {
        console.error('[VideoExporter] Encoder error:', error);
        this.cancelled = true;
      },
    });

    // Configure encoder with hardware acceleration
    const codec = this.config.codec || 'avc1.640033';
    const encoderConfig: VideoEncoderConfig = {
      codec,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.bitrate,
      framerate: this.config.frameRate,
      latencyMode: 'realtime',
      bitrateMode: 'variable',
      hardwareAcceleration: 'prefer-hardware',
    };

    const support = await VideoEncoder.isConfigSupported(encoderConfig);
    
    if (support.supported) {
      this.encoder.configure(encoderConfig);
    } else {
      // Fallback to software encoding
      encoderConfig.hardwareAcceleration = 'prefer-software';
      const softwareSupport = await VideoEncoder.isConfigSupported(encoderConfig);
      if (!softwareSupport.supported) {
        throw new Error('Video encoding not supported');
      }
      this.encoder.configure(encoderConfig);
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.encoder) {
      try {
        if (this.encoder.state === 'configured') {
          this.encoder.close();
        }
      } catch (e) {
        console.warn('Error closing encoder:', e);
      }
      this.encoder = null;
    }

    if (this.decoder) {
      try {
        this.decoder.destroy();
      } catch (e) {
        console.warn('Error destroying decoder:', e);
      }
      this.decoder = null;
    }

    if (this.renderer) {
      try {
        this.renderer.destroy();
      } catch (e) {
        console.warn('Error destroying renderer:', e);
      }
      this.renderer = null;
    }

    this.muxer = null;
    this.encodeQueue = 0;
    this.muxingPromises = [];
    this.chunkCount = 0;
    this.videoDescription = undefined;
    this.videoColorSpace = undefined;
  }
}
