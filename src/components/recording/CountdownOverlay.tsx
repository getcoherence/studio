import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

const COUNTDOWN_STEPS = [3, 2, 1, 0] as const;
const STEP_DURATION_MS = 900;

interface CountdownOverlayProps {
	onComplete: () => void;
	onCancel: () => void;
}

export function CountdownOverlay({ onComplete, onCancel }: CountdownOverlayProps) {
	const [step, setStep] = useState(0);
	const [cancelled, setCancelled] = useState(false);
	const currentValue = COUNTDOWN_STEPS[step];

	const cancel = useCallback(() => {
		setCancelled(true);
		onCancel();
	}, [onCancel]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				cancel();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [cancel]);

	useEffect(() => {
		if (cancelled) return;

		if (step >= COUNTDOWN_STEPS.length) return;

		if (currentValue === 0) {
			const timer = setTimeout(() => {
				onComplete();
			}, 400);
			return () => clearTimeout(timer);
		}

		const timer = setTimeout(() => {
			setStep((s) => s + 1);
		}, STEP_DURATION_MS);

		return () => clearTimeout(timer);
	}, [step, currentValue, cancelled, onComplete]);

	if (cancelled) return null;

	return (
		<div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
			<div className="w-[280px] h-[280px] rounded-3xl bg-black/70 backdrop-blur-xl flex items-center justify-center relative overflow-hidden">
				<AnimatePresence mode="wait">
					<motion.div
						key={currentValue}
						initial={{ scale: 0.5, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 1.5, opacity: 0 }}
						transition={{ duration: 0.35, ease: "easeOut" }}
						className="flex items-center justify-center"
					>
						{currentValue > 0 ? (
							<span className="text-white text-[120px] font-bold leading-none select-none tabular-nums drop-shadow-lg">
								{currentValue}
							</span>
						) : (
							<span className="text-[#34B27B] text-[64px] font-bold leading-none select-none tracking-tight drop-shadow-lg">
								Go!
							</span>
						)}
					</motion.div>
				</AnimatePresence>

				{/* Esc hint */}
				<div className="absolute bottom-4 text-white/30 text-xs select-none">
					Press Esc to cancel
				</div>
			</div>
		</div>
	);
}
