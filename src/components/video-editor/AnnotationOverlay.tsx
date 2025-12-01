import { useRef } from "react";
import { Rnd } from "react-rnd";
import type { AnnotationRegion } from "./types";
import { cn } from "@/lib/utils";
import { 
  FaArrowUp, FaArrowDown, FaArrowLeft, FaArrowRight,
  FaCircle, FaSquare, FaStar, FaHeart, FaPlay
} from "react-icons/fa";
import { 
  BsArrowUpRight, BsArrowDownRight, BsArrowDownLeft, BsArrowUpLeft
} from "react-icons/bs";
import { BiRectangle } from "react-icons/bi";

interface AnnotationOverlayProps {
  annotation: AnnotationRegion;
  isSelected: boolean;
  containerWidth: number;
  containerHeight: number;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onSizeChange: (id: string, size: { width: number; height: number }) => void;
  onClick: (id: string) => void;
  zIndex: number;
  isSelectedBoost: boolean; // Boost z-index when selected for easy editing
}

export function AnnotationOverlay({
  annotation,
  isSelected,
  containerWidth,
  containerHeight,
  onPositionChange,
  onSizeChange,
  onClick,
  zIndex,
  isSelectedBoost,
}: AnnotationOverlayProps) {
  const x = (annotation.position.x / 100) * containerWidth;
  const y = (annotation.position.y / 100) * containerHeight;
  const width = (annotation.size.width / 100) * containerWidth;
  const height = (annotation.size.height / 100) * containerHeight;

  console.log('[AnnotationOverlay] Rendering:', {
    id: annotation.id,
    type: annotation.type,
    content: annotation.content.substring(0, 30),
    position: annotation.position,
    size: annotation.size,
    containerWidth,
    containerHeight,
    calculatedPixels: { x, y, width, height },
    isSelected
  });

  const isDraggingRef = useRef(false);

  const renderArrow = () => {
    const direction = annotation.figureData?.arrowDirection || 'right';
    const color = annotation.figureData?.color || '#34B27B';
    const iconProps = {
      style: { 
        width: '100%', 
        height: '100%',
        color,
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
      }
    };

    switch (direction) {
      case 'up': return <FaArrowUp {...iconProps} />;
      case 'down': return <FaArrowDown {...iconProps} />;
      case 'left': return <FaArrowLeft {...iconProps} />;
      case 'right': return <FaArrowRight {...iconProps} />;
      case 'up-right': return <BsArrowUpRight {...iconProps} />;
      case 'up-left': return <BsArrowUpLeft {...iconProps} />;
      case 'down-right': return <BsArrowDownRight {...iconProps} />;
      case 'down-left': return <BsArrowDownLeft {...iconProps} />;
      default: return <FaArrowRight {...iconProps} />;
    }
  };

  const renderShape = () => {
    const shapeType = annotation.figureData?.shapeType || 'circle';
    const color = annotation.figureData?.color || '#34B27B';
    const filled = annotation.figureData?.filled ?? true;
    const strokeWidth = annotation.figureData?.strokeWidth || 4;

    const shapeStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      color: filled ? color : 'transparent',
      stroke: color,
      strokeWidth: filled ? 0 : strokeWidth,
      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
    };

    const IconComponent = (() => {
      switch (shapeType) {
        case 'circle': return FaCircle;
        case 'square': return FaSquare;
        case 'triangle': return FaPlay;
        case 'rectangle': return BiRectangle;
        case 'star': return FaStar;
        case 'heart': return FaHeart;
        default: return FaCircle;
      }
    })();

    return filled ? (
      <IconComponent style={shapeStyle} />
    ) : (
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        {shapeType === 'circle' && (
          <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth={strokeWidth} />
        )}
        {shapeType === 'square' && (
          <rect x="10" y="10" width="80" height="80" fill="none" stroke={color} strokeWidth={strokeWidth} />
        )}
        {shapeType === 'rectangle' && (
          <rect x="5" y="20" width="90" height="60" fill="none" stroke={color} strokeWidth={strokeWidth} />
        )}
        {shapeType === 'triangle' && (
          <polygon points="50,10 90,90 10,90" fill="none" stroke={color} strokeWidth={strokeWidth} />
        )}
        {shapeType === 'star' && (
          <polygon points="50,5 61,38 95,38 68,59 79,92 50,71 21,92 32,59 5,38 39,38" fill="none" stroke={color} strokeWidth={strokeWidth} />
        )}
        {shapeType === 'heart' && (
          <path d="M50,85 C50,85 10,60 10,35 C10,20 20,10 30,10 C40,10 50,20 50,20 C50,20 60,10 70,10 C80,10 90,20 90,35 C90,60 50,85 50,85 Z" fill="none" stroke={color} strokeWidth={strokeWidth} />
        )}
      </svg>
    );
  };

  const renderContent = () => {
    switch (annotation.type) {
      case 'text':
        return (
          <div
            className="w-full h-full flex items-center p-2 overflow-hidden"
            style={{
              justifyContent: annotation.style.textAlign === 'left' ? 'flex-start' : 
                            annotation.style.textAlign === 'right' ? 'flex-end' : 'center',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                color: annotation.style.color,
                backgroundColor: annotation.style.backgroundColor,
                fontSize: `${annotation.style.fontSize}px`,
                fontFamily: annotation.style.fontFamily,
                fontWeight: annotation.style.fontWeight,
                fontStyle: annotation.style.fontStyle,
                textDecoration: annotation.style.textDecoration,
                textAlign: annotation.style.textAlign,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
                padding: '0.1em 0.2em',
                borderRadius: '4px',
                lineHeight: '1.4',
              }}
            >
              {annotation.content}
            </span>
          </div>
        );

      case 'image':
        if (annotation.content && annotation.content.startsWith('data:image')) {
          return (
            <img
              src={annotation.content}
              alt="Annotation"
              className="w-full h-full object-contain"
              draggable={false}
            />
          );
        }
        return (
          <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
            No image
          </div>
        );

      case 'figure':
        if (!annotation.figureData) {
          return (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
              No figure data
            </div>
          );
        }

        const figureType = annotation.figureData.figureType;

        if (figureType === 'arrow') {
          return (
            <div className="w-full h-full flex items-center justify-center p-2">
              {renderArrow()}
            </div>
          );
        }

        if (figureType === 'shape') {
          return (
            <div className="w-full h-full flex items-center justify-center p-2">
              {renderShape()}
            </div>
          );
        }

        if (figureType === 'emoji') {
          const emojiSize = annotation.figureData.emojiSize || 64;
          return (
            <div className="w-full h-full flex items-center justify-center" style={{ fontSize: `${emojiSize}px` }}>
              {annotation.figureData.emoji || '😊'}
            </div>
          );
        }

        return null;

      default:
        return null;
    }
  };

  return (
    <Rnd
      position={{ x, y }}
      size={{ width, height }}
      onDragStart={() => {
        isDraggingRef.current = true;
      }}
      onDragStop={(_e, d) => {
        const xPercent = (d.x / containerWidth) * 100;
        const yPercent = (d.y / containerHeight) * 100;
        onPositionChange(annotation.id, { x: xPercent, y: yPercent });
        
        // Reset dragging flag after a short delay to prevent click event
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 100);
      }}
      onResizeStop={(_e, _direction, ref, _delta, position) => {
        const xPercent = (position.x / containerWidth) * 100;
        const yPercent = (position.y / containerHeight) * 100;
        const widthPercent = (ref.offsetWidth / containerWidth) * 100;
        const heightPercent = (ref.offsetHeight / containerHeight) * 100;
        onPositionChange(annotation.id, { x: xPercent, y: yPercent });
        onSizeChange(annotation.id, { width: widthPercent, height: heightPercent });
      }}
      onClick={() => {
        if (isDraggingRef.current) return;
        onClick(annotation.id);
      }}
      bounds="parent"
      className={cn(
        "cursor-move transition-all",
        isSelected && "ring-2 ring-[#34B27B] ring-offset-2 ring-offset-transparent"
      )}
      style={{
        zIndex: isSelectedBoost ? zIndex + 1000 : zIndex, // Boost selected annotation to ensure it's on top
        pointerEvents: isSelected ? 'auto' : 'none',
        border: isSelected ? '2px solid rgba(52, 178, 123, 0.8)' : 'none',
        backgroundColor: isSelected ? 'rgba(52, 178, 123, 0.1)' : 'transparent',
        boxShadow: isSelected ? '0 0 0 1px rgba(52, 178, 123, 0.35)' : 'none',
      }}
      enableResizing={isSelected}
      disableDragging={!isSelected}
      resizeHandleStyles={{
        topLeft: {
          width: '12px',
          height: '12px',
          backgroundColor: isSelected ? 'white' : 'transparent',
          border: isSelected ? '2px solid #34B27B' : 'none',
          borderRadius: '50%',
          left: '-6px',
          top: '-6px',
          cursor: 'nwse-resize',
        },
        topRight: {
          width: '12px',
          height: '12px',
          backgroundColor: isSelected ? 'white' : 'transparent',
          border: isSelected ? '2px solid #34B27B' : 'none',
          borderRadius: '50%',
          right: '-6px',
          top: '-6px',
          cursor: 'nesw-resize',
        },
        bottomLeft: {
          width: '12px',
          height: '12px',
          backgroundColor: isSelected ? 'white' : 'transparent',
          border: isSelected ? '2px solid #34B27B' : 'none',
          borderRadius: '50%',
          left: '-6px',
          bottom: '-6px',
          cursor: 'nesw-resize',
        },
        bottomRight: {
          width: '12px',
          height: '12px',
          backgroundColor: isSelected ? 'white' : 'transparent',
          border: isSelected ? '2px solid #34B27B' : 'none',
          borderRadius: '50%',
          right: '-6px',
          bottom: '-6px',
          cursor: 'nwse-resize',
        },
      }}
    >
      <div
        className={cn(
          "w-full h-full rounded-lg",
          annotation.type === 'text' && "bg-transparent",
          annotation.type === 'image' && "bg-transparent",
          annotation.type === 'figure' && "bg-transparent",
          isSelected && "shadow-lg"
        )}
      >
        {renderContent()}
      </div>
    </Rnd>
  );
}
