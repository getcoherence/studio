import { useItem } from "dnd-timeline";
import type { Span } from "dnd-timeline";
import { cn } from "@/lib/utils";
import { ZoomIn } from "lucide-react";
import glassStyles from "./ItemGlass.module.css";

interface ItemProps {
  id: string;
  span: Span;
  rowId: string;
  children: React.ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
  zoomDepth: number;
}

// Map zoom depth to multiplier labels
const ZOOM_LABELS: Record<number, string> = {
  1: "1.25×",
  2: "1.5×",
  3: "1.8×",
  4: "2.2×",
  5: "3.5×",
};

export default function Item({ id, span, rowId, isSelected = false, onSelect, zoomDepth }: ItemProps) {
  const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
    id,
    span,
    data: { rowId },
  });

  return (
    <div
      ref={setNodeRef}
      style={itemStyle}
      {...listeners}
      {...attributes}
      onPointerDownCapture={() => onSelect?.()}
      className="group"
    >
      <div style={itemContentStyle}>
        <div
          className={cn(
            "w-full h-full overflow-hidden flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing relative",
            glassStyles.glassGreen,
            isSelected && glassStyles.selected
          )}
          style={{ height: 48 }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.();
          }}
        >
          <div className={cn(glassStyles.zoomEndCap, glassStyles.left)} />
          <div className={cn(glassStyles.zoomEndCap, glassStyles.right)} />
          
          {/* Content */}
          <div className="relative z-10 flex items-center gap-1.5 text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none">
            <ZoomIn className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold tracking-tight">
              {ZOOM_LABELS[zoomDepth] || `${zoomDepth}×`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}