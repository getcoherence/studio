import { useEffect, useRef } from "react";
import { ANIMATED_BACKGROUNDS, type AnimatedBackground } from "@/lib/backgrounds";
import { cn } from "@/lib/utils";

interface AnimatedBackgroundPickerProps {
	selected: string;
	onSelect: (id: string) => void;
	onHover?: (id: string) => void;
	onHoverEnd?: () => void;
}

/** Small canvas thumbnail that renders an animated background at low FPS for preview. */
function AnimatedThumbnail({
	bg,
	isSelected,
	onClick,
	onMouseEnter,
	onMouseLeave,
}: {
	bg: AnimatedBackground;
	isSelected: boolean;
	onClick: () => void;
	onMouseEnter?: () => void;
	onMouseLeave?: () => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastDrawRef = useRef(0);

	useEffect(() => {
		let running = true;

		const draw = () => {
			if (!running) return;
			const now = performance.now();
			// Render at ~2 FPS (every 500ms) to keep CPU low
			if (now - lastDrawRef.current >= 500) {
				lastDrawRef.current = now;
				const canvas = canvasRef.current;
				if (canvas) {
					const ctx = canvas.getContext("2d");
					if (ctx) {
						bg.render(ctx, canvas.width, canvas.height, now);
					}
				}
			}
			rafRef.current = requestAnimationFrame(draw);
		};

		draw();

		return () => {
			running = false;
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, [bg]);

	return (
		<div
			className={cn(
				"relative rounded-md border-2 overflow-hidden cursor-pointer transition-all duration-200 shadow-sm",
				isSelected
					? "border-[#2563eb] ring-1 ring-[#2563eb]/30"
					: "border-white/10 hover:border-[#2563eb]/40 opacity-80 hover:opacity-100 bg-white/5",
				!bg.available && "opacity-50 cursor-not-allowed",
			)}
			style={{ width: 36, height: 36 }}
			onClick={() => {
				if (bg.available) onClick();
			}}
			onMouseEnter={() => {
				if (bg.available) onMouseEnter?.();
			}}
			onMouseLeave={() => onMouseLeave?.()}
			role="button"
			aria-label={bg.name}
		>
			{bg.available ? (
				<canvas ref={canvasRef} width={80} height={50} className="w-full h-full" />
			) : (
				<div
					className="w-full h-full flex items-center justify-center"
					style={{ backgroundColor: bg.previewColor }}
				>
					<span className="text-[6px] text-white/60 text-center leading-tight px-0.5">Soon</span>
				</div>
			)}
		</div>
	);
}

export function AnimatedBackgroundPicker({
	selected,
	onSelect,
	onHover,
	onHoverEnd,
}: AnimatedBackgroundPickerProps) {
	// Group by category
	const grouped = new Map<string, AnimatedBackground[]>();
	for (const bg of ANIMATED_BACKGROUNDS) {
		const list = grouped.get(bg.category) ?? [];
		list.push(bg);
		grouped.set(bg.category, list);
	}

	return (
		<div className="space-y-2">
			{Array.from(grouped.entries()).map(([category, bgs]) => (
				<div key={category}>
					<div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">{category}</div>
					<div className="grid grid-cols-7 gap-1.5">
						{bgs.map((bg) => (
							<AnimatedThumbnail
								key={bg.id}
								bg={bg}
								isSelected={selected === bg.id}
								onClick={() => onSelect(bg.id)}
								onMouseEnter={() => onHover?.(bg.id)}
								onMouseLeave={() => onHoverEnd?.()}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
