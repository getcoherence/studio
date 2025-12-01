import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Trash2, Type, Image as ImageIcon, Upload, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, ChevronDown, Info, Shapes, Smile } from "lucide-react";
import { toast } from "sonner";
import Colorful from '@uiw/react-color-colorful';
import { hsvaToHex, hexToHsva } from '@uiw/color-convert';
import type { AnnotationRegion, AnnotationType, FigureType, ArrowDirection, ShapeType, FigureData } from "./types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { 
  FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight,
  FaCircle, FaSquare, FaStar, FaHeart
} from "react-icons/fa";
import { 
  BsArrowUpRight, BsArrowDownRight, BsArrowDownLeft, BsArrowUpLeft
} from "react-icons/bs";
import { FaPlay } from "react-icons/fa";
import { BiRectangle } from "react-icons/bi";

interface AnnotationSettingsPanelProps {
  annotation: AnnotationRegion;
  onContentChange: (content: string) => void;
  onTypeChange: (type: AnnotationType) => void;
  onStyleChange: (style: Partial<AnnotationRegion['style']>) => void;
  onFigureDataChange?: (figureData: FigureData) => void;
  onDelete: () => void;
}

const FONT_FAMILIES = [
  { value: 'system-ui, -apple-system, sans-serif', label: 'Classic' },
  { value: 'Georgia, serif', label: 'Editor' },
  { value: 'Impact, Arial Black, sans-serif', label: 'Strong' },
  { value: 'Courier New, monospace', label: 'Typewriter' },
  { value: 'Brush Script MT, cursive', label: 'Deco' },
  { value: 'Arial, sans-serif', label: 'Simple' },
  { value: 'Verdana, sans-serif', label: 'Modern' },
  { value: 'Trebuchet MS, sans-serif', label: 'Clean' },
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 128];

export function AnnotationSettingsPanel({
  annotation,
  onContentChange,
  onTypeChange,
  onStyleChange,
  onFigureDataChange,
  onDelete,
}: AnnotationSettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textColorHsva, setTextColorHsva] = useState(hexToHsva(annotation.style.color));
  const [bgColorHsva, setBgColorHsva] = useState(hexToHsva(annotation.style.backgroundColor || '#00000000'));
  const [figureColorHsva, setFigureColorHsva] = useState(
    hexToHsva(annotation.figureData?.color || '#34B27B')
  );
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);



  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Please upload a JPG, PNG, GIF, or WebP image file.',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        onContentChange(dataUrl);
        toast.success('Image uploaded successfully!');
      }
    };

    reader.onerror = () => {
      toast.error('Failed to upload image', {
        description: 'There was an error reading the file.',
      });
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="flex-[2] min-w-0 bg-[#09090b] border border-white/5 rounded-2xl p-4 flex flex-col shadow-xl h-full overflow-y-auto custom-scrollbar">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-200">Annotation Settings</span>
          <span className="text-[10px] uppercase tracking-wider font-medium text-[#34B27B] bg-[#34B27B]/10 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
        
        {/* Type Selector */}
        <Tabs value={annotation.type} onValueChange={(value) => onTypeChange(value as AnnotationType)} className="mb-6">
          <TabsList className="mb-4 bg-white/5 border border-white/5 p-1 w-full grid grid-cols-3 h-auto rounded-xl">
            <TabsTrigger value="text" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all gap-2">
              <Type className="w-4 h-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="image" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all gap-2">
              <ImageIcon className="w-4 h-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="figure" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-lg transition-all gap-2">
              <Shapes className="w-4 h-4" />
              Figure
            </TabsTrigger>
          </TabsList>

          {/* Text Content */}
          <TabsContent value="text" className="mt-0 space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-200 mb-2 block">Text Content</label>
              <textarea
                value={annotation.textContent || annotation.content}
                onChange={(e) => onContentChange(e.target.value)}
                placeholder="Enter your text..."
                rows={5}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#34B27B] focus:border-transparent resize-none"
              />
            </div>

            {/* Styling Controls */}
            <div className="space-y-4">
              {/* Font Family & Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-200 mb-2 block">Font Style</label>
                  <Select 
                    value={annotation.style.fontFamily} 
                    onValueChange={(value) => onStyleChange({ fontFamily: value })}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-slate-200 h-9 text-xs">
                      <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1c] border-white/10 text-slate-200">
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200 mb-2 block">Size</label>
                  <Select 
                    value={annotation.style.fontSize.toString()} 
                    onValueChange={(value) => onStyleChange({ fontSize: parseInt(value) })}
                  >
                    <SelectTrigger className="w-full bg-white/5 border-white/10 text-slate-200 h-9 text-xs">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1a1c] border-white/10 text-slate-200 max-h-[200px]">
                      {FONT_SIZES.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}px
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Formatting Toggles */}
              <div className="flex items-center justify-between gap-2">
                <ToggleGroup type="multiple" className="justify-start bg-white/5 p-1 rounded-lg border border-white/5">
                  <ToggleGroupItem 
                    value="bold" 
                    aria-label="Toggle bold"
                    data-state={annotation.style.fontWeight === 'bold' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ fontWeight: annotation.style.fontWeight === 'bold' ? 'normal' : 'bold' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <Bold className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="italic" 
                    aria-label="Toggle italic"
                    data-state={annotation.style.fontStyle === 'italic' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ fontStyle: annotation.style.fontStyle === 'italic' ? 'normal' : 'italic' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <Italic className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="underline" 
                    aria-label="Toggle underline"
                    data-state={annotation.style.textDecoration === 'underline' ? 'on' : 'off'}
                    onClick={() => onStyleChange({ textDecoration: annotation.style.textDecoration === 'underline' ? 'none' : 'underline' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <Underline className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>

                <ToggleGroup type="single" value={annotation.style.textAlign} className="justify-start bg-white/5 p-1 rounded-lg border border-white/5">
                  <ToggleGroupItem 
                    value="left" 
                    aria-label="Align left"
                    onClick={() => onStyleChange({ textAlign: 'left' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="center" 
                    aria-label="Align center"
                    onClick={() => onStyleChange({ textAlign: 'center' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="right" 
                    aria-label="Align right"
                    onClick={() => onStyleChange({ textAlign: 'right' })}
                    className="h-8 w-8 data-[state=on]:bg-[#34B27B] data-[state=on]:text-white text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  >
                    <AlignRight className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-200 mb-2 block">Text Color</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-9 justify-start gap-2 bg-white/5 border-white/10 hover:bg-white/10 px-2"
                      >
                        <div 
                          className="w-4 h-4 rounded-full border border-white/20" 
                          style={{ backgroundColor: annotation.style.color }}
                        />
                        <span className="text-xs text-slate-300 truncate flex-1 text-left">
                          {annotation.style.color}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none bg-transparent shadow-xl">
                      <div className="p-2 bg-[#1a1a1c] border border-white/10 rounded-xl">
                        <Colorful
                          color={textColorHsva}
                          disableAlpha={true}
                          onChange={(color) => {
                            setTextColorHsva(color.hsva);
                            onStyleChange({ color: hsvaToHex(color.hsva) });
                          }}
                          style={{ width: '100%', borderRadius: '8px' }}
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-200 mb-2 block">Background</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full h-9 justify-start gap-2 bg-white/5 border-white/10 hover:bg-white/10 px-2"
                      >
                        <div 
                          className="w-4 h-4 rounded-full border border-white/20 relative overflow-hidden" 
                        >
                          <div className="absolute inset-0 checkerboard-bg opacity-50" />
                          <div 
                            className="absolute inset-0"
                            style={{ backgroundColor: annotation.style.backgroundColor }}
                          />
                        </div>
                        <span className="text-xs text-slate-300 truncate flex-1 text-left">
                          {annotation.style.backgroundColor === 'transparent' ? 'None' : 'Color'}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none bg-transparent shadow-xl">
                      <div className="p-2 bg-[#1a1a1c] border border-white/10 rounded-xl">
                        <Colorful
                          color={bgColorHsva}
                          onChange={(color) => {
                            setBgColorHsva(color.hsva);
                            onStyleChange({ backgroundColor: hsvaToHex(color.hsva) });
                          }}
                          style={{ width: '100%', borderRadius: '8px' }}
                        />
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2 text-xs h-7 hover:bg-white/5 text-slate-400"
                          onClick={() => {
                            onStyleChange({ backgroundColor: 'transparent' });
                            setBgColorHsva({ h: 0, s: 0, v: 0, a: 0 });
                          }}
                        >
                          Clear Background
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>


          </TabsContent>

          {/* Image Upload */}
          <TabsContent value="image" className="mt-0 space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept=".jpg,.jpeg,.png,.gif,.webp,image/*"
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full gap-2 bg-white/5 text-slate-200 border-white/10 hover:bg-[#34B27B] hover:text-white hover:border-[#34B27B] transition-all py-8"
            >
              <Upload className="w-5 h-5" />
              Upload Image
            </Button>

            {annotation.content && annotation.content.startsWith('data:image') && (
              <div className="rounded-lg border border-white/10 overflow-hidden bg-white/5 p-2">
                <img
                  src={annotation.content}
                  alt="Uploaded annotation"
                  className="w-full h-auto rounded-md"
                />
              </div>
            )}

            <p className="text-xs text-slate-500 text-center leading-relaxed">
              Supported formats: JPG, PNG, GIF, WebP
            </p>
          </TabsContent>

          <TabsContent value="figure" className="mt-0 space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-200 mb-2 block">Figure Type</label>
              <Tabs 
                value={annotation.figureData?.figureType || 'arrow'} 
                onValueChange={(value) => {
                  const newFigureData: FigureData = {
                    ...annotation.figureData!,
                    figureType: value as FigureType,
                  };
                  onFigureDataChange?.(newFigureData);
                }}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-3 bg-white/5 border border-white/5 p-1 h-auto rounded-lg">
                  <TabsTrigger value="arrow" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-md transition-all gap-1.5 text-xs">
                    <FaArrowRight className="w-3 h-3" />
                    Arrow
                  </TabsTrigger>
                  <TabsTrigger value="shape" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-md transition-all gap-1.5 text-xs">
                    <FaCircle className="w-3 h-3" />
                    Shape
                  </TabsTrigger>
                  <TabsTrigger value="emoji" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-slate-400 py-2 rounded-md transition-all gap-1.5 text-xs">
                    <Smile className="w-3 h-3" />
                    Emoji
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="arrow" className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-200 mb-3 block">Arrows</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 'up' as ArrowDirection, icon: FaArrowUp },
                        { value: 'down' as ArrowDirection, icon: FaArrowDown },
                        { value: 'left' as ArrowDirection, icon: FaArrowLeft },
                        { value: 'right' as ArrowDirection, icon: FaArrowRight },
                        { value: 'up-right' as ArrowDirection, icon: BsArrowUpRight },
                        { value: 'up-left' as ArrowDirection, icon: BsArrowUpLeft },
                        { value: 'down-right' as ArrowDirection, icon: BsArrowDownRight },
                        { value: 'down-left' as ArrowDirection, icon: BsArrowDownLeft },
                      ].map(({ value, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => {
                            const newFigureData: FigureData = {
                              ...annotation.figureData!,
                              arrowDirection: value,
                            };
                            onFigureDataChange?.(newFigureData);
                          }}
                          className={cn(
                            "h-16 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all",
                            annotation.figureData?.arrowDirection === value
                              ? "bg-[#34B27B] border-[#34B27B] text-white"
                              : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="shape" className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-200 mb-3 block">Shape Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'circle' as ShapeType, icon: FaCircle, label: 'Circle' },
                        { value: 'square' as ShapeType, icon: FaSquare, label: 'Square' },
                        { value: 'rectangle' as ShapeType, icon: BiRectangle, label: 'Rectangle' },
                        { value: 'triangle' as ShapeType, icon: FaPlay, label: 'Triangle' },
                        { value: 'star' as ShapeType, icon: FaStar, label: 'Star' },
                        { value: 'heart' as ShapeType, icon: FaHeart, label: 'Heart' },
                      ].map(({ value, icon: Icon, label }) => (
                        <button
                          key={value}
                          onClick={() => {
                            const newFigureData: FigureData = {
                              ...annotation.figureData!,
                              shapeType: value,
                            };
                            onFigureDataChange?.(newFigureData);
                          }}
                          className={cn(
                            "h-16 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all",
                            annotation.figureData?.shapeType === value
                              ? "bg-[#34B27B] border-[#34B27B] text-white"
                              : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[10px]">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                    <label className="text-xs font-medium text-slate-200">Filled</label>
                    <Switch
                      checked={annotation.figureData?.filled ?? true}
                      onCheckedChange={(checked) => {
                        const newFigureData: FigureData = {
                          ...annotation.figureData!,
                          filled: checked,
                        };
                        onFigureDataChange?.(newFigureData);
                      }}
                    />
                  </div>

                  {!annotation.figureData?.filled && (
                    <div>
                      <label className="text-xs font-medium text-slate-200 mb-2 block">
                        Stroke Width: {annotation.figureData?.strokeWidth || 4}px
                      </label>
                      <Slider
                        value={[annotation.figureData?.strokeWidth || 4]}
                        onValueChange={([value]) => {
                          const newFigureData: FigureData = {
                            ...annotation.figureData!,
                            strokeWidth: value,
                          };
                          onFigureDataChange?.(newFigureData);
                        }}
                        min={1}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="emoji" className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-200 mb-2 block">Selected Emoji</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-16 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-4xl">
                        {annotation.figureData?.emoji || '😊'}
                      </div>
                      <Button
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        variant="outline"
                        className="h-16 px-6 bg-[#34B27B] text-white border-[#34B27B] hover:bg-[#2a9163] hover:border-[#2a9163]"
                      >
                        {showEmojiPicker ? 'Close' : 'Pick'}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-200 mb-2 block">
                      Emoji Size: {annotation.figureData?.emojiSize || 64}px
                    </label>
                    <Slider
                      value={[annotation.figureData?.emojiSize || 64]}
                      onValueChange={([value]) => {
                        const newFigureData: FigureData = {
                          ...annotation.figureData!,
                          emojiSize: value,
                        };
                        onFigureDataChange?.(newFigureData);
                      }}
                      min={16}
                      max={200}
                      step={4}
                      className="w-full"
                    />
                  </div>

                  {showEmojiPicker && (
                    <div className="border border-white/10 rounded-lg overflow-hidden">
                      <EmojiPicker
                        onEmojiClick={(emojiData: EmojiClickData) => {
                          const newFigureData: FigureData = {
                            ...annotation.figureData!,
                            emoji: emojiData.emoji,
                          };
                          onFigureDataChange?.(newFigureData);
                          setShowEmojiPicker(false);
                        }}
                        width="100%"
                        height={300}
                        searchPlaceHolder="Search emoji..."
                        previewConfig={{ showPreview: false }}
                      />
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {annotation.figureData?.figureType !== 'emoji' && (
              <div>
                <label className="text-xs font-medium text-slate-200 mb-2 block">Color</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full h-10 justify-start gap-2 bg-white/5 border-white/10 hover:bg-white/10"
                    >
                      <div 
                        className="w-5 h-5 rounded-full border border-white/20" 
                        style={{ backgroundColor: annotation.figureData?.color || '#34B27B' }}
                      />
                      <span className="text-xs text-slate-300 truncate flex-1 text-left">
                        {annotation.figureData?.color || '#34B27B'}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none bg-transparent shadow-xl">
                    <div className="p-2 bg-[#1a1a1c] border border-white/10 rounded-xl">
                      <Colorful
                        color={figureColorHsva}
                        disableAlpha={true}
                        onChange={(color) => {
                          setFigureColorHsva(color.hsva);
                          const newFigureData: FigureData = {
                            ...annotation.figureData!,
                            color: hsvaToHex(color.hsva),
                          };
                          onFigureDataChange?.(newFigureData);
                        }}
                        style={{ width: '100%', borderRadius: '8px' }}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Button
          onClick={onDelete}
          variant="destructive"
          size="sm"
          className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all mt-4"
        >
          <Trash2 className="w-4 h-4" />
          Delete Annotation
        </Button>

        <div className="mt-6 p-3 bg-white/5 rounded-lg border border-white/5">
          <div className="flex items-center gap-2 mb-2 text-slate-300">
            <Info className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Shortcuts & Tips</span>
          </div>
          <ul className="text-[10px] text-slate-400 space-y-1.5 list-disc pl-3 leading-relaxed">
            <li>Move playhead to overlapping annotation section and select an item.</li>
            <li>Use <kbd className="px-1 py-0.5 bg-white/10 rounded text-slate-300 font-mono">Tab</kbd> to cycle through overlapping items.</li>
            <li>Use <kbd className="px-1 py-0.5 bg-white/10 rounded text-slate-300 font-mono">Shift+Tab</kbd> to cycle backwards.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
