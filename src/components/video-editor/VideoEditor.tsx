

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import PlaybackControls from "./PlaybackControls";
import TimelineEditor from "./timeline/TimelineEditor";
import { SettingsPanel } from "./SettingsPanel";
import { ExportDialog } from "./ExportDialog";
import { WindowControls } from "./WindowControls";
import type { Span } from "dnd-timeline";
import {
  DEFAULT_ZOOM_DEPTH,
  clampFocusToDepth,
  DEFAULT_CROP_REGION,
  type ZoomDepth,
  type ZoomFocus,
  type ZoomRegion,
  type CropRegion,
} from "./types";
import { VideoExporter, type ExportProgress } from "@/lib/exporter";

const WALLPAPER_COUNT = 12;
const WALLPAPER_PATHS = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `/wallpapers/wallpaper${i + 1}.jpg`);

export default function VideoEditor() {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [wallpaper, setWallpaper] = useState<string>(WALLPAPER_PATHS[0]);
  const [showShadow, setShowShadow] = useState(false);
  const [showBlur, setShowBlur] = useState(false);
  const [cropRegion, setCropRegion] = useState<CropRegion>(DEFAULT_CROP_REGION);
  const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
  const nextZoomIdRef = useRef(1);
  const exporterRef = useRef<VideoExporter | null>(null);

  useEffect(() => {
    async function loadVideo() {
      try {
        const result = await window.electronAPI.getRecordedVideoPath();
        if (result.success && result.path) {
          setVideoPath(`file://${result.path}`);
        } else {
          setError(result.message || 'Failed to load video');
        }
      } catch (err) {
        setError('Error loading video: ' + String(err));
      } finally {
        setLoading(false);
      }
    }
    loadVideo();
  }, []);

  function togglePlayPause() {
    const playback = videoPlaybackRef.current;
    const video = playback?.video;
    console.log('Toggle play/pause:', { hasVideo: !!video, isPlaying, action: isPlaying ? 'pause' : 'play' });
    if (!playback || !video) return;

    if (isPlaying) {
      playback.pause();
    } else {
      playback.play().catch(err => console.error('Video play failed:', err));
    }
  }

  function handleSeek(time: number) {
    const video = videoPlaybackRef.current?.video;
    if (!video) return;
    video.currentTime = time;
  }

  const handleSelectZoom = useCallback((id: string | null) => {
    setSelectedZoomId(id);
  }, []);

  const handleZoomAdded = useCallback((span: Span) => {
    const id = `zoom-${nextZoomIdRef.current++}`;
    const newRegion: ZoomRegion = {
      id,
      startMs: Math.round(span.start),
      endMs: Math.round(span.end),
      depth: DEFAULT_ZOOM_DEPTH,
      focus: { cx: 0.5, cy: 0.5 },
    };
    console.log('Zoom region added:', newRegion);
    setZoomRegions((prev) => [...prev, newRegion]);
    setSelectedZoomId(id);
  }, []);

  const handleZoomSpanChange = useCallback((id: string, span: Span) => {
    console.log('Zoom span changed:', { id, start: Math.round(span.start), end: Math.round(span.end) });
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? {
              ...region,
              startMs: Math.round(span.start),
              endMs: Math.round(span.end),
            }
          : region,
      ),
    );
  }, []);

  const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === id
          ? {
              ...region,
              focus: clampFocusToDepth(focus, region.depth),
            }
          : region,
      ),
    );
  }, []);

  const handleZoomDepthChange = useCallback((depth: ZoomDepth) => {
    if (!selectedZoomId) return;
    setZoomRegions((prev) =>
      prev.map((region) =>
        region.id === selectedZoomId
          ? {
              ...region,
              depth,
              focus: clampFocusToDepth(region.focus, depth),
            }
          : region,
      ),
    );
  }, [selectedZoomId]);

  const handleZoomDelete = useCallback((id: string) => {
    console.log('Zoom region deleted:', id);
    setZoomRegions((prev) => prev.filter((region) => region.id !== id));
    if (selectedZoomId === id) {
      setSelectedZoomId(null);
    }
  }, [selectedZoomId]);

  const selectedZoom = useMemo(() => {
    if (!selectedZoomId) return null;
    return zoomRegions.find((region) => region.id === selectedZoomId) ?? null;
  }, [selectedZoomId, zoomRegions]);

  useEffect(() => {
    if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
      setSelectedZoomId(null);
    }
  }, [selectedZoomId, zoomRegions]);

  const handleExport = useCallback(async () => {
    if (!videoPath) {
      toast.error('No video loaded');
      return;
    }

    const video = videoPlaybackRef.current?.video;
    if (!video) {
      toast.error('Video not ready');
      return;
    }

    setShowExportDialog(true);
    setIsExporting(true);
    setExportProgress(null);
    setExportError(null);

    try {
      const wasPlaying = isPlaying;
      if (wasPlaying) {
        videoPlaybackRef.current?.pause();
      }

      const width = 1920;
      const height = 1080;

      const exporter = new VideoExporter({
        videoUrl: videoPath,
        width,
        height,
        frameRate: 60,
        bitrate: 15_000_000,
        codec: 'avc1.640033',
        wallpaper,
        zoomRegions,
        showShadow,
        showBlur,
        cropRegion,
        onProgress: (progress: ExportProgress) => {
          setExportProgress(progress);
        },
      });

      exporterRef.current = exporter;
      const result = await exporter.export();

      if (result.success && result.blob) {
        const arrayBuffer = await result.blob.arrayBuffer();
        const timestamp = Date.now();
        const fileName = `export-${timestamp}.mp4`;
        
        const saveResult = await window.electronAPI.saveExportedVideo(arrayBuffer, fileName);
        
        if (saveResult.success) {
          toast.success('Video exported successfully!');
        } else {
          setExportError(saveResult.message || 'Failed to save video');
          toast.error(saveResult.message || 'Failed to save video');
        }
      } else {
        setExportError(result.error || 'Export failed');
        toast.error(result.error || 'Export failed');
      }

      if (wasPlaying) {
        videoPlaybackRef.current?.play();
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setExportError(errorMessage);
      toast.error(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
      exporterRef.current = null;
    }
  }, [videoPath, wallpaper, zoomRegions, showShadow, showBlur, cropRegion, isPlaying]);

  const handleCancelExport = useCallback(() => {
    if (exporterRef.current) {
      exporterRef.current.cancel();
      toast.info('Export cancelled');
      setShowExportDialog(false);
      setIsExporting(false);
      setExportProgress(null);
      setExportError(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-foreground">Loading video...</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  const isMac = navigator.userAgent.includes('Mac');

  return (
    <div className="flex flex-col h-screen bg-background bg-black">
      {/* Drag region for window - more padding on macOS for traffic lights */}
      <div 
        className={`h-8 flex-shrink-0 bg-black/50 backdrop-blur-sm flex items-center justify-between ${isMac ? 'pl-20 pr-4' : 'px-4'}`}
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex-1" />
        <WindowControls />
      </div>
      <div className="flex flex-1 p-4 gap-4 overflow-hidden">
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Toaster position="top-center" />
        </div>
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          progress={exportProgress}
          isExporting={isExporting}
          error={exportError}
          onCancel={handleCancelExport}
        />
      <div className="flex flex-col flex-[7] min-w-0 gap-4">
        <div className="flex flex-col gap-2 flex-1">
          {videoPath && (
            <>
              <div className="flex justify-center w-full">
                <VideoPlayback
                  ref={videoPlaybackRef}
                  videoPath={videoPath}
                  onDurationChange={setDuration}
                  onTimeUpdate={setCurrentTime}
                  onPlayStateChange={setIsPlaying}
                  onError={setError}
                  wallpaper={wallpaper}
                  zoomRegions={zoomRegions}
                  selectedZoomId={selectedZoomId}
                  onSelectZoom={handleSelectZoom}
                  onZoomFocusChange={handleZoomFocusChange}
                  isPlaying={isPlaying}
                  showShadow={showShadow}
                  showBlur={showBlur}
                  cropRegion={cropRegion}
                />
              </div>
              <PlaybackControls
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                onTogglePlayPause={togglePlayPause}
                onSeek={handleSeek}
              />
            </>
          )}
        </div>
        <TimelineEditor
          videoDuration={duration}
          currentTime={currentTime}
          onSeek={handleSeek}
          zoomRegions={zoomRegions}
          onZoomAdded={handleZoomAdded}
          onZoomSpanChange={handleZoomSpanChange}
          onZoomDelete={handleZoomDelete}
          selectedZoomId={selectedZoomId}
          onSelectZoom={handleSelectZoom}
        />
      </div>
      <SettingsPanel
        selected={wallpaper}
        onWallpaperChange={setWallpaper}
        selectedZoomDepth={selectedZoom?.depth}
        onZoomDepthChange={handleZoomDepthChange}
        selectedZoomId={selectedZoomId}
        onZoomDelete={handleZoomDelete}
        showShadow={showShadow}
        onShadowChange={setShowShadow}
        showBlur={showBlur}
        onBlurChange={setShowBlur}
        cropRegion={cropRegion}
        onCropChange={setCropRegion}
        videoElement={videoPlaybackRef.current?.video || null}
        onExport={handleExport}
      />
      </div>
    </div>
  );
}