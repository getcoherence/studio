import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { getAssetPath } from "@/lib/assetPath";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Colorful from '@uiw/react-color-colorful';
import { hsvaToHex } from '@uiw/color-convert';
import { Trash2, Download, Crop, X, Bug } from "lucide-react";
import type { ZoomDepth, CropRegion } from "./types";
import { CropControl } from "./CropControl";

const WALLPAPER_COUNT = 23;
const WALLPAPER_RELATIVE = Array.from({ length: WALLPAPER_COUNT }, (_, i) => `wallpapers/wallpaper${i + 1}.jpg`);
const GRADIENTS = [
  "linear-gradient( 111.6deg,  rgba(114,167,232,1) 9.4%, rgba(253,129,82,1) 43.9%, rgba(253,129,82,1) 54.8%, rgba(249,202,86,1) 86.3% )",
  "linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)",
  "radial-gradient( circle farthest-corner at 3.2% 49.6%,  rgba(80,12,139,0.87) 0%, rgba(161,10,144,0.72) 83.6% )",
  "linear-gradient( 111.6deg,  rgba(0,56,68,1) 0%, rgba(163,217,185,1) 51.5%, rgba(231, 148, 6, 1) 88.6% )",
  "linear-gradient( 107.7deg,  rgba(235,230,44,0.55) 8.4%, rgba(252,152,15,1) 90.3% )",
  "linear-gradient( 91deg,  rgba(72,154,78,1) 5.2%, rgba(251,206,70,1) 95.9% )",
  "radial-gradient( circle farthest-corner at 10% 20%,  rgba(2,37,78,1) 0%, rgba(4,56,126,1) 19.7%, rgba(85,245,221,1) 100.2% )",
  "linear-gradient( 109.6deg,  rgba(15,2,2,1) 11.2%, rgba(36,163,190,1) 91.1% )",
  "linear-gradient(135deg, #FBC8B4, #2447B1)",
  "linear-gradient(109.6deg, #F635A6, #36D860)",
  "linear-gradient(90deg, #FF0101, #4DFF01)",
  "linear-gradient(315deg, #EC0101, #5044A9)",
  "linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)",
  "linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(to right, #ff8177 0%, #ff867a 0%, #ff8c7f 21%, #f99185 52%, #cf556c 78%, #b12a5b 100%)",
  "linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(to right, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(to top, #fcc5e4 0%, #fda34b 15%, #ff7882 35%, #c8699e 52%, #7046aa 71%, #0c1db8 87%, #020f75 100%)",
  "linear-gradient(to right, #fa709a 0%, #fee140 100%)",
  "linear-gradient(to top, #30cfd0 0%, #330867 100%)",
  "linear-gradient(to top, #c471f5 0%, #fa71cd 100%)",
  "linear-gradient(to right, #f78ca0 0%, #f9748f 19%, #fd868c 60%, #fe9a8b 100%)",
  "linear-gradient(to top, #48c6ef 0%, #6f86d6 100%)",
  "linear-gradient(to right, #0acffe 0%, #495aff 100%)",
];

interface SettingsPanelProps {
  selected: string;
  onWallpaperChange: (path: string) => void;
  selectedZoomDepth?: ZoomDepth | null;
  onZoomDepthChange?: (depth: ZoomDepth) => void;
  selectedZoomId?: string | null;
  onZoomDelete?: (id: string) => void;
  showShadow?: boolean;
  onShadowChange?: (showShadow: boolean) => void;
  showBlur?: boolean;
  onBlurChange?: (showBlur: boolean) => void;
  cropRegion?: CropRegion;
  onCropChange?: (region: CropRegion) => void;
  videoElement?: HTMLVideoElement | null;
  onExport?: () => void;
}

export default SettingsPanel;

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
  { depth: 1, label: "1.25×" },
  { depth: 2, label: "1.5×" },
  { depth: 3, label: "1.8×" },
  { depth: 4, label: "2.2×" },
  { depth: 5, label: "3.5×" },
];

export function SettingsPanel({ selected, onWallpaperChange, selectedZoomDepth, onZoomDepthChange, selectedZoomId, onZoomDelete, showShadow, onShadowChange, showBlur, onBlurChange, cropRegion, onCropChange, videoElement, onExport }: SettingsPanelProps) {
  const [wallpaperPaths, setWallpaperPaths] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const resolved = await Promise.all(WALLPAPER_RELATIVE.map(p => getAssetPath(p)))
        if (mounted) setWallpaperPaths(resolved)
      } catch (err) {
        if (mounted) setWallpaperPaths(WALLPAPER_RELATIVE.map(p => `/${p}`))
      }
    })()
    return () => { mounted = false }
  }, [])
  const [hsva, setHsva] = useState({ h: 0, s: 0, v: 68, a: 1 });
  const [gradient, setGradient] = useState<string>(GRADIENTS[0]);
  const [showCropDropdown, setShowCropDropdown] = useState(false);

  const zoomEnabled = Boolean(selectedZoomDepth);
  
  const handleDeleteClick = () => {
    if (selectedZoomId && onZoomDelete) {
      onZoomDelete(selectedZoomId);
    }
  };

  return (
    <div className="flex-[3] min-w-0 bg-[#09090b] border border-white/5 rounded-2xl p-6 flex flex-col shadow-xl h-full overflow-y-auto custom-scrollbar">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-200">Zoom Level</span>
          {zoomEnabled && selectedZoomDepth && (
            <span className="text-[10px] uppercase tracking-wider font-medium text-[#34B27B] bg-[#34B27B]/10 px-2 py-1 rounded-full">
              {ZOOM_DEPTH_OPTIONS.find(o => o.depth === selectedZoomDepth)?.label} Active
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ZOOM_DEPTH_OPTIONS.map((option) => {
            const isActive = selectedZoomDepth === option.depth;
            return (
              <Button
                key={option.depth}
                type="button"
                disabled={!zoomEnabled}
                onClick={() => onZoomDepthChange?.(option.depth)}
                className={cn(
                  "h-auto w-full rounded-xl border px-1 py-3 text-center shadow-sm transition-all flex flex-col items-center justify-center gap-1.5",
                  "duration-200 ease-out",
                  zoomEnabled ? "opacity-100 cursor-pointer" : "opacity-40 cursor-not-allowed",
                  isActive
                    ? "border-[#34B27B] bg-[#34B27B] text-white shadow-[#34B27B]/20 scale-105 ring-2 ring-[#34B27B]/20"
                    : "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10 hover:text-slate-200"
                )}
              >
                <span className={cn("text-sm font-semibold tracking-tight")}>{option.label}</span>
              </Button>
            );
          })}
        </div>
        {!zoomEnabled && (
          <p className="text-xs text-slate-500 mt-3 text-center">Select a zoom region in the timeline to adjust depth.</p>
        )}
        {zoomEnabled && (
          <Button
            onClick={handleDeleteClick}
            variant="destructive"
            size="sm"
            className="mt-4 w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete Zoom Region
          </Button>
        )}
      </div>

      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="text-sm font-medium text-slate-200">Drop Shadow</div>
          <Switch
            checked={showShadow}
            onCheckedChange={onShadowChange}
            className="data-[state=checked]:bg-[#34B27B]"
          />
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="text-sm font-medium text-slate-200">Blur Background</div>
          <Switch
            checked={showBlur}
            onCheckedChange={onBlurChange}
            className="data-[state=checked]:bg-[#34B27B]"
          />
        </div>
      </div>

      <div className="mb-8">
        <Button
          onClick={() => setShowCropDropdown(!showCropDropdown)}
          variant="outline"
          className="w-full gap-2 bg-white/5 text-slate-200 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white h-11 transition-all"
        >
          <Crop className="w-4 h-4" />
          Crop Video
        </Button>
        <p className="text-[10px] text-slate-500 text-center mt-3 px-4 leading-relaxed">
          If the preview looks weirdly positioned at any time, try force reloading (you will lose all your progress)
        </p>
      </div>
      
      {showCropDropdown && cropRegion && onCropChange && (
        <>
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-200"
            onClick={() => setShowCropDropdown(false)}
          />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] bg-[#09090b] rounded-2xl shadow-2xl border border-white/10 p-8 w-[90vw] max-w-5xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xl font-bold text-slate-200">Crop Video</span>
                <p className="text-sm text-slate-400 mt-2">Drag on each side to adjust the crop area</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCropDropdown(false)}
                className="hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <CropControl
              videoElement={videoElement || null}
              cropRegion={cropRegion}
              onCropChange={onCropChange}
            />
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setShowCropDropdown(false)}
                size="lg"
                className="bg-[#34B27B] hover:bg-[#34B27B]/90 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </>
      )}

      <Tabs defaultValue="image" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mb-4 bg-white/5 border border-white/5 p-1 w-full grid grid-cols-3 h-auto rounded-xl">
          <TabsTrigger value="image" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all">Image</TabsTrigger>
          <TabsTrigger value="color" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all">Color</TabsTrigger>
          <TabsTrigger value="gradient" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all">Gradient</TabsTrigger>
        </TabsList>
        
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
          <TabsContent value="image" className="mt-0">
            <div className="grid grid-cols-6 gap-2">
              {(wallpaperPaths.length > 0 ? wallpaperPaths : WALLPAPER_RELATIVE.map(p => `/${p}`)).map((path, idx) => {
                const isSelected = (() => {
                  if (!selected) return false;
                  
                  if (selected === path) return true;
                  try {
                    const clean = (s: string) => s.replace(/^file:\/\//, '').replace(/^\//, '')
                    if (clean(selected).endsWith(clean(path))) return true;
                    if (clean(path).endsWith(clean(selected))) return true;
                  } catch {
                  }
                  return false;
                })();

                return (
                  <div
                    key={path}
                    className={cn(
                      "aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200",
                      isSelected
                        ? "border-[#34B27B] ring-2 ring-[#34B27B]/30 scale-105 shadow-lg shadow-[#34B27B]/10"
                        : "border-white/5 hover:border-white/20 hover:scale-105 opacity-70 hover:opacity-100"
                    )}
                    style={{ backgroundImage: `url(${path})`, backgroundSize: "cover", backgroundPosition: "center" }}
                    aria-label={`Wallpaper ${idx + 1}`}
                    onClick={() => onWallpaperChange(path)}
                    role="button"
                  />
                )
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="color" className="mt-0">
            <div className="p-1">
              <Colorful
                color={hsva}
                disableAlpha={true}
                onChange={(color) => {
                  setHsva(color.hsva);
                  onWallpaperChange(hsvaToHex(color.hsva));
                }}
                style={{ width: '100%', borderRadius: '12px' }}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="gradient" className="mt-0">
            <div className="grid grid-cols-6 gap-2">
              {GRADIENTS.map((g, idx) => (
                <div
                  key={g}
                  className={cn(
                    "aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200",
                    gradient === g 
                      ? "border-[#34B27B] ring-2 ring-[#34B27B]/30 scale-105 shadow-lg shadow-[#34B27B]/10" 
                      : "border-white/5 hover:border-white/20 hover:scale-105 opacity-70 hover:opacity-100"
                  )}
                  style={{ background: g }}
                  aria-label={`Gradient ${idx + 1}`}
                  onClick={() => { setGradient(g); onWallpaperChange(g); }}
                  role="button"
                />
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="mt-6 pt-6 border-t border-white/5">
        <Button
          type="button"
          size="lg"
          onClick={onExport}
          className="w-full py-6 text-lg font-semibold flex items-center justify-center gap-3 bg-[#34B27B] text-white rounded-xl shadow-lg shadow-[#34B27B]/20 hover:bg-[#34B27B]/90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <Download className="w-5 h-5" />
          <span>Export Video</span>
        </Button>
        <button
          type="button"
          onClick={() => {
            window.electronAPI?.openExternalUrl('https://github.com/siddharthvaddem/openscreen/issues/new');
          }}
          className="w-full mt-4 flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors py-2 group"
        >
          <Bug className="w-3 h-3 group-hover:text-[#34B27B] transition-colors" />
          <span>Report a Bug</span>
        </button>
      </div>
    </div>
  );
}
