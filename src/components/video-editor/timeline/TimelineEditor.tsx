import { useCallback, useEffect, useMemo, useState } from "react";
import { useTimelineContext } from "dnd-timeline";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import TimelineWrapper from "./TimelineWrapper";
import Row from "./Row";
import Item from "./Item";
import type { Range, Span } from "dnd-timeline";
import type { ZoomRegion } from "../types";

const ROW_ID = "row-1";
const FALLBACK_RANGE_MS = 1000;
const TARGET_MARKER_COUNT = 12;

interface TimelineEditorProps {
  videoDuration: number;
  currentTime: number;
  onSeek?: (time: number) => void;
  zoomRegions: ZoomRegion[];
  onZoomAdded: (span: Span) => void;
  onZoomSpanChange: (id: string, span: Span) => void;
  onZoomDelete: (id: string) => void;
  selectedZoomId: string | null;
  onSelectZoom: (id: string | null) => void;
}

interface TimelineScaleConfig {
  intervalMs: number;
  gridMs: number;
  minItemDurationMs: number;
  defaultItemDurationMs: number;
  minVisibleRangeMs: number;
}

interface TimelineRenderItem {
  id: string;
  rowId: string;
  span: Span;
  label: string;
  zoomDepth: number;
}

const SCALE_CANDIDATES = [
  { intervalSeconds: 0.25, gridSeconds: 0.05 },
  { intervalSeconds: 0.5, gridSeconds: 0.1 },
  { intervalSeconds: 1, gridSeconds: 0.25 },
  { intervalSeconds: 2, gridSeconds: 0.5 },
  { intervalSeconds: 5, gridSeconds: 1 },
  { intervalSeconds: 10, gridSeconds: 2 },
  { intervalSeconds: 15, gridSeconds: 3 },
  { intervalSeconds: 30, gridSeconds: 5 },
  { intervalSeconds: 60, gridSeconds: 10 },
  { intervalSeconds: 120, gridSeconds: 20 },
  { intervalSeconds: 300, gridSeconds: 30 },
  { intervalSeconds: 600, gridSeconds: 60 },
  { intervalSeconds: 900, gridSeconds: 120 },
  { intervalSeconds: 1800, gridSeconds: 180 },
  { intervalSeconds: 3600, gridSeconds: 300 },
];

function calculateTimelineScale(durationSeconds: number): TimelineScaleConfig {
  const totalMs = Math.max(0, Math.round(durationSeconds * 1000));

  const selectedCandidate = SCALE_CANDIDATES.find((candidate) => {
    if (durationSeconds <= 0) {
      return true;
    }
    const markers = durationSeconds / candidate.intervalSeconds;
    return markers <= TARGET_MARKER_COUNT;
  }) ?? SCALE_CANDIDATES[SCALE_CANDIDATES.length - 1];

  const intervalMs = Math.round(selectedCandidate.intervalSeconds * 1000);
  const gridMs = Math.round(selectedCandidate.gridSeconds * 1000);

  // Set minItemDurationMs to 1ms for maximum granularity
  const minItemDurationMs = 1;
  const defaultItemDurationMs = Math.min(
    Math.max(minItemDurationMs, intervalMs * 2),
    totalMs > 0 ? totalMs : intervalMs * 2,
  );

  const minVisibleRangeMs = totalMs > 0
    ? Math.min(Math.max(intervalMs * 3, minItemDurationMs * 6, 1000), totalMs)
    : Math.max(intervalMs * 3, minItemDurationMs * 6, 1000);

  return {
    intervalMs,
    gridMs,
    minItemDurationMs,
    defaultItemDurationMs,
    minVisibleRangeMs,
  };
}

function createInitialRange(totalMs: number): Range {
  if (totalMs > 0) {
    return { start: 0, end: totalMs };
  }

  return { start: 0, end: FALLBACK_RANGE_MS };
}

function formatTimeLabel(milliseconds: number, intervalMs: number) {
  const totalSeconds = milliseconds / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const fractionalDigits = intervalMs < 250 ? 2 : intervalMs < 1000 ? 1 : 0;

  if (hours > 0) {
    const minutesString = minutes.toString().padStart(2, "0");
    const secondsString = Math.floor(seconds)
      .toString()
      .padStart(2, "0");
    return `${hours}:${minutesString}:${secondsString}`;
  }

  if (fractionalDigits > 0) {
    const secondsWithFraction = seconds.toFixed(fractionalDigits);
    const [wholeSeconds, fraction] = secondsWithFraction.split(".");
    return `${minutes}:${wholeSeconds.padStart(2, "0")}.${fraction}`;
  }

  return `${minutes}:${Math.floor(seconds).toString().padStart(2, "0")}`;
}

function PlaybackCursor({ 
  currentTimeMs, 
  videoDurationMs 
}: { 
  currentTimeMs: number; 
  videoDurationMs: number;
}) {
  const { sidebarWidth, direction, range, valueToPixels } = useTimelineContext();
  const sideProperty = direction === "rtl" ? "right" : "left";

  if (videoDurationMs <= 0 || currentTimeMs < 0) {
    return null;
  }

  const clampedTime = Math.min(currentTimeMs, videoDurationMs);
  
  if (clampedTime < range.start || clampedTime > range.end) {
    return null;
  }

  const offset = valueToPixels(clampedTime - range.start);

  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none z-50"
      style={{
        [sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth - 1}px`,
      }}
    >
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-[#34B27B] shadow-[0_0_10px_rgba(52,178,123,0.5)]"
        style={{
          [sideProperty]: `${offset}px`,
        }}
      >
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2"
          style={{ width: '12px', height: '12px' }}
        >
          <div className="w-full h-full bg-[#34B27B] rotate-45 rounded-sm shadow-lg border border-white/20" />
        </div>
      </div>
    </div>
  );
}

function TimelineAxis({
  intervalMs,
  videoDurationMs,
  currentTimeMs,
}: {
  intervalMs: number;
  videoDurationMs: number;
  currentTimeMs: number;
}) {
  const { sidebarWidth, direction, range, valueToPixels } = useTimelineContext();
  const sideProperty = direction === "rtl" ? "right" : "left";

  const markers = useMemo(() => {
    if (intervalMs <= 0) {
      return { markers: [], minorTicks: [] };
    }

    const maxTime = videoDurationMs > 0 ? videoDurationMs : range.end;
    const visibleStart = Math.max(0, Math.min(range.start, maxTime));
    const visibleEnd = Math.min(range.end, maxTime);
    const markerTimes = new Set<number>();

    const firstMarker = Math.ceil(visibleStart / intervalMs) * intervalMs;

    for (let time = firstMarker; time <= maxTime; time += intervalMs) {
      if (time >= visibleStart && time <= visibleEnd) {
        markerTimes.add(Math.round(time));
      }
    }

    if (visibleStart <= maxTime) {
      markerTimes.add(Math.round(visibleStart));
    }
    
    if (videoDurationMs > 0) {
      markerTimes.add(Math.round(videoDurationMs));
    }

    const sorted = Array.from(markerTimes)
      .filter(time => time <= maxTime)
      .sort((a, b) => a - b);

    // Generate minor ticks (4 ticks between major intervals)
    const minorTicks = [];
    const minorInterval = intervalMs / 5;
    
    for (let time = firstMarker; time <= maxTime; time += minorInterval) {
      if (time >= visibleStart && time <= visibleEnd) {
        // Skip if it's close to a major marker
        const isMajor = Math.abs(time % intervalMs) < 1;
        if (!isMajor) {
          minorTicks.push(time);
        }
      }
    }

    return { 
      markers: sorted.map((time) => ({
        time,
        label: formatTimeLabel(time, intervalMs),
      })), 
      minorTicks 
    };
  }, [intervalMs, range.end, range.start, videoDurationMs]);

  return (
    <div
      className="h-8 bg-[#09090b] border-b border-white/5 relative overflow-hidden select-none"
      style={{
        [sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth}px`,
      }}
    >
      {/* Minor Ticks */}
      {markers.minorTicks.map((time) => {
        const offset = valueToPixels(time - range.start);
        return (
          <div
            key={`minor-${time}`}
            className="absolute bottom-0 h-1 w-[1px] bg-white/5"
            style={{ [sideProperty]: `${offset}px` }}
          />
        );
      })}

      {/* Major Markers */}
      {markers.markers.map((marker) => {
        const offset = valueToPixels(marker.time - range.start);
        const markerStyle: React.CSSProperties = {
          position: "absolute",
          bottom: 0,
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          [sideProperty]: `${offset}px`,
        };

        return (
          <div key={marker.time} style={markerStyle}>
            <div className="flex flex-col items-center pb-1">
              <div className="h-2 w-[1px] bg-white/20 mb-1" />
              <span
                className={cn(
                  "text-[10px] font-medium tabular-nums tracking-tight",
                  marker.time === currentTimeMs ? "text-[#34B27B]" : "text-slate-500"
                )}
              >
                {marker.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Timeline({
  items,
  videoDurationMs,
  intervalMs,
  currentTimeMs,
  onSeek,
  onSelectZoom,
  selectedZoomId,
}: {
  items: TimelineRenderItem[];
  videoDurationMs: number;
  intervalMs: number;
  currentTimeMs: number;
  onSeek?: (time: number) => void;
  onSelectZoom?: (id: string | null) => void;
  selectedZoomId: string | null;
}) {
  const { setTimelineRef, style, sidebarWidth, range, pixelsToValue } = useTimelineContext();

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || videoDurationMs <= 0) return;
    onSelectZoom?.(null);

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - sidebarWidth;
    
    if (clickX < 0) return;
    
    const relativeMs = pixelsToValue(clickX);
    const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
    const timeInSeconds = absoluteMs / 1000;
    
    onSeek(timeInSeconds);
  }, [onSeek, onSelectZoom, videoDurationMs, sidebarWidth, range.start, pixelsToValue]);

  return (
    <div
      ref={setTimelineRef}
      style={style}
      className="select-none bg-[#09090b] min-h-[140px] relative cursor-pointer group"
      onClick={handleTimelineClick}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px)] bg-[length:20px_100%] pointer-events-none" />
      <TimelineAxis intervalMs={intervalMs} videoDurationMs={videoDurationMs} currentTimeMs={currentTimeMs} />
      <PlaybackCursor currentTimeMs={currentTimeMs} videoDurationMs={videoDurationMs} />
      <Row id={ROW_ID}>
        {items.map((item) => (
          <Item
            id={item.id}
            key={item.id}
            rowId={item.rowId}
            span={item.span}
            isSelected={item.id === selectedZoomId}
            onSelect={() => onSelectZoom?.(item.id)}
            zoomDepth={item.zoomDepth}
          >
            {item.label}
          </Item>
        ))}
      </Row>
    </div>
  );
}

export default function TimelineEditor({
  videoDuration,
  currentTime,
  onSeek,
  zoomRegions,
  onZoomAdded,
  onZoomSpanChange,
  selectedZoomId,
  onSelectZoom,
}: TimelineEditorProps) {
  const totalMs = useMemo(() => Math.max(0, Math.round(videoDuration * 1000)), [videoDuration]);
  const currentTimeMs = useMemo(() => Math.round(currentTime * 1000), [currentTime]);
  const timelineScale = useMemo(() => calculateTimelineScale(videoDuration), [videoDuration]);
  const safeMinDurationMs = useMemo(
    () => (totalMs > 0 ? Math.min(timelineScale.minItemDurationMs, totalMs) : timelineScale.minItemDurationMs),
    [timelineScale.minItemDurationMs, totalMs],
  );

  const [range, setRange] = useState<Range>(() => createInitialRange(totalMs));

  useEffect(() => {
    setRange(createInitialRange(totalMs));
  }, [totalMs]);

  useEffect(() => {
    if (totalMs === 0 || safeMinDurationMs <= 0) {
      return;
    }

    zoomRegions.forEach((region) => {
      const clampedStart = Math.max(0, Math.min(region.startMs, totalMs));
      const minEnd = clampedStart + safeMinDurationMs;
      const clampedEnd = Math.min(totalMs, Math.max(minEnd, region.endMs));
      const normalizedStart = Math.max(0, Math.min(clampedStart, totalMs - safeMinDurationMs));
      const normalizedEnd = Math.max(minEnd, Math.min(clampedEnd, totalMs));

      if (normalizedStart !== region.startMs || normalizedEnd !== region.endMs) {
        onZoomSpanChange(region.id, { start: normalizedStart, end: normalizedEnd });
      }
    });
  }, [zoomRegions, totalMs, safeMinDurationMs, onZoomSpanChange]);

  const hasOverlap = useCallback((newSpan: Span, excludeId?: string): boolean => {
    // Snap if gap is 2ms or less
    return zoomRegions.some((region) => {
      if (region.id === excludeId) return false;
      const gapBefore = newSpan.start - region.endMs;
      const gapAfter = region.startMs - newSpan.end;
      if (gapBefore > 0 && gapBefore <= 2) return true;
      if (gapAfter > 0 && gapAfter <= 2) return true;
      return !(newSpan.end <= region.startMs || newSpan.start >= region.endMs);
    });
  }, [zoomRegions]);

  const handleAddZoom = useCallback(() => {
    if (!videoDuration || videoDuration === 0 || totalMs === 0) {
      return;
    }

    const defaultDuration = Math.min(
      Math.max(3000, safeMinDurationMs),
      totalMs,
    );

    if (defaultDuration <= 0) {
      return;
    }

    let startPos = 0;
    const sorted = [...zoomRegions].sort((a, b) => a.startMs - b.startMs);

    for (const region of sorted) {
      if (startPos + defaultDuration <= region.startMs) {
        break;
      }
      startPos = Math.max(startPos, region.endMs);
    }

    if (startPos + defaultDuration > totalMs) {
      toast.error("No space available", {
        description: "Remove or resize existing zoom regions to add more.",
      });
      return;
    }

    onZoomAdded({ start: startPos, end: startPos + defaultDuration });
  }, [videoDuration, totalMs, timelineScale.defaultItemDurationMs, safeMinDurationMs, zoomRegions, onZoomAdded]);

  const clampedRange = useMemo<Range>(() => {
    if (totalMs === 0) {
      return range;
    }

    return {
      start: Math.max(0, Math.min(range.start, totalMs)),
      end: Math.min(range.end, totalMs),
    };
  }, [range, totalMs]);

  const timelineItems = useMemo<TimelineRenderItem[]>(() => {
    return [...zoomRegions]
      .sort((a, b) => a.startMs - b.startMs)
      .map((region, index) => ({
        id: region.id,
        rowId: ROW_ID,
        span: { start: region.startMs, end: region.endMs },
        label: `Zoom ${index + 1}`,
        zoomDepth: region.depth,
      }));
  }, [zoomRegions]);

  if (!videoDuration || videoDuration === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-[#09090b] gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
          <Plus className="w-6 h-6 text-slate-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">No Video Loaded</p>
          <p className="text-xs text-slate-500 mt-1">Drag and drop a video to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#09090b] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-[#09090b]">
        <Button 
          onClick={handleAddZoom} 
          variant="outline" 
          size="sm" 
          className="gap-2 h-7 px-3 text-xs bg-white/5 border-white/10 text-slate-200 hover:bg-[#34B27B] hover:text-white hover:border-[#34B27B] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Zoom
        </Button>
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-400 font-sans">⇧ + ⌘ + Scroll</kbd>
            <span>Pan</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-slate-400 font-sans">⌘ + Scroll</kbd>
            <span>Zoom</span>
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-[#09090b] relative">
        <TimelineWrapper
          range={clampedRange}
          videoDuration={videoDuration}
          hasOverlap={hasOverlap}
          onRangeChange={setRange}
          minItemDurationMs={timelineScale.minItemDurationMs}
          minVisibleRangeMs={timelineScale.minVisibleRangeMs}
          gridSizeMs={timelineScale.gridMs}
          onItemSpanChange={onZoomSpanChange}
        >
          <Timeline
            items={timelineItems}
            videoDurationMs={totalMs}
            intervalMs={timelineScale.intervalMs}
            currentTimeMs={currentTimeMs}
            onSeek={onSeek}
            onSelectZoom={onSelectZoom}
            selectedZoomId={selectedZoomId}
          />
        </TimelineWrapper>
      </div>
    </div>
  );
}
