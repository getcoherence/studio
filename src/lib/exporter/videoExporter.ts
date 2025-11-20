import type { ExportConfig, ExportProgress, ExportResult } from './types';
import { VideoFileDecoder } from './videoDecoder';
import { FrameRenderer } from './frameRenderer';
import { VideoMuxer } from './muxer';
import type { ZoomRegion, CropRegion } from '@/components/video-editor/types';

interface VideoExporterConfig extends ExportConfig {
  videoUrl: string;
  wallpaper: string;
  zoomRegions: ZoomRegion[];
  showShadow: boolean;
  showBlur: boolean;
  cropRegion: CropRegion;
  onProgress?: (progress: ExportProgress) => void;
}

export class VideoExporter {
  private config: VideoExporterConfig;
  private decoder: VideoFileDecoder | null = null;
  private renderer: FrameRenderer | null = null;
  private encoder: VideoEncoder | null = null;
  private muxer: VideoMuxer | null = null;
  private cancelled = false;
  private encodedChunks: EncodedVideoChunk[] = [];
  private encodeQueue = 0;
  private readonly MAX_ENCODE_QUEUE = 60;
  private videoDescription: Uint8Array | undefined;

  constructor(config: VideoExporterConfig) {
    this.config = config;
  }

  async export(): Promise<ExportResult> {
    try {
      this.cleanup();
      this.cancelled = false;

      // Initialize decoder and load video
      this.decoder = new VideoFileDecoder();
      const videoInfo = await this.decoder.loadVideo(this.config.videoUrl);

      // Initialize frame renderer
      this.renderer = new FrameRenderer({
        width: this.config.width,
        height: this.config.height,
        wallpaper: this.config.wallpaper,
        zoomRegions: this.config.zoomRegions,
        showShadow: this.config.showShadow,
        showBlur: this.config.showBlur,
        cropRegion: this.config.cropRegion,
        videoWidth: videoInfo.width,
        videoHeight: videoInfo.height,
      });
      await this.renderer.initialize();

      // Initialize video encoder
      const totalFrames = Math.ceil(videoInfo.duration * this.config.frameRate);
      await this.initializeEncoder();

      // Initialize muxer
      this.muxer = new VideoMuxer(this.config, false);
      await this.muxer.initialize();

      // Get the video element for frame extraction
      const videoElement = this.decoder.getVideoElement();
      if (!videoElement) {
        throw new Error('Video element not available');
      }

      // Process frames with optimized seeking
      const frameDuration = 1_000_000 / this.config.frameRate; // in microseconds
      let frameIndex = 0;
      const timeStep = 1 / this.config.frameRate;

      // Pre-load first frame
      videoElement.currentTime = 0;
      await new Promise(resolve => {
        const onSeeked = () => {
          videoElement.removeEventListener('seeked', onSeeked);
          resolve(null);
        };
        videoElement.addEventListener('seeked', onSeeked);
      });

      while (frameIndex < totalFrames && !this.cancelled) {
        const timestamp = frameIndex * frameDuration;
        const videoTime = frameIndex * timeStep;
        // Seek to frame (only seek if not already there)
        if (Math.abs(videoElement.currentTime - videoTime) > 0.001) {
          videoElement.currentTime = videoTime;
          await Promise.race([
            new Promise(resolve => {
              const onSeeked = () => {
                videoElement.removeEventListener('seeked', onSeeked);
                // Wait for video to render the frame
                videoElement.requestVideoFrameCallback(() => resolve(null));
              };
              videoElement.addEventListener('seeked', onSeeked, { once: true });
            }),
            new Promise(resolve => setTimeout(resolve, 200)) // higher this number, slower the export, but better capture/ no frame drops
          ]);
        }

        // Create a VideoFrame from the video element (on GPU!)
        const videoFrame = new VideoFrame(videoElement, {
          timestamp,
        });

        // Render the frame with all effects
        await this.renderer!.renderFrame(videoFrame, timestamp);
        
        videoFrame.close();

        while (this.encodeQueue >= this.MAX_ENCODE_QUEUE && !this.cancelled) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }

        if (this.cancelled) break;

        const canvas = this.renderer!.getCanvas();
        
        // CRITICAL FIX for Windows: Explicitly specify colorSpace when creating VideoFrame from canvas
        // Without this, VideoFrame.colorSpace can be null on Windows, causing "Cannot read properties of null" error
        // Using BT.709 with sRGB transfer (IEC 61966-2-1) which is standard for HD video
        // @ts-ignore - TypeScript definitions may not include all VideoFrameInit properties
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

        if (this.encoder && this.encoder.state === 'configured') {
          this.encodeQueue++;
          this.encoder.encode(exportFrame, { keyFrame: frameIndex % 150 === 0 });
        }
        exportFrame.close();

        frameIndex++;

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

      // Finalize encoding
      if (this.encoder && this.encoder.state === 'configured') {
        await this.encoder.flush();
      }

      // Add all chunks to muxer with metadata
      for (let i = 0; i < this.encodedChunks.length; i++) {
        const chunk = this.encodedChunks[i];
        const meta: EncodedVideoChunkMetadata = {};
        
        // Add decoder config for the first chunk
        if (i === 0 && this.videoDescription) {
          meta.decoderConfig = {
            codec: this.config.codec || 'avc1.640033',
            codedWidth: this.config.width,
            codedHeight: this.config.height,
            description: this.videoDescription,
          };
        }
        
        this.muxer!.addVideoChunk(chunk, meta);
      }

      // Finalize muxer and get output blob
      const blob = this.muxer!.finalize();

      return { success: true, blob };
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.cleanup();
    }
  }

  private async initializeEncoder(): Promise<void> {
    this.encodedChunks = [];
    this.encodeQueue = 0;
    let videoDescription: Uint8Array | undefined;

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (meta?.decoderConfig?.description && !videoDescription) {
          const desc = meta.decoderConfig.description;
          videoDescription = new Uint8Array(desc instanceof ArrayBuffer ? desc : (desc as any));
          this.videoDescription = videoDescription;
        }
        this.encodedChunks.push(chunk);
        this.encodeQueue--;
      },
      error: (error) => {
        console.error('VideoEncoder error:', error);
      },
    });

    const codec = this.config.codec || 'avc1.640033';
    
    this.encoder.configure({
      codec,
      width: this.config.width,
      height: this.config.height,
      bitrate: this.config.bitrate,
      framerate: this.config.frameRate,
      latencyMode: 'realtime',
      bitrateMode: 'variable',
      hardwareAcceleration: 'prefer-hardware',
    } as VideoEncoderConfig);
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
    this.encodedChunks = [];
    this.encodeQueue = 0;
    this.videoDescription = undefined;
  }
}
