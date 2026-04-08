// ── Director Chat Panel ──────────────────────────────────────────────────
//
// Chat UI for the Creative Director. Cursor-style input area with model
// selector and image attachment inside the input container.

import { Image, Loader2, Send, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ScenePlan } from "@/lib/ai/scenePlan";
import { type DirectorMessage, refineScenePlan } from "@/lib/ai/scenePlanDirector";
import { AI_PROVIDERS } from "@/lib/ai/types";

/** Providers that support vision / image input */
const VISION_PROVIDERS = new Set(["openai", "anthropic"]);

interface DirectorChatProps {
	scenePlan: ScenePlan | null;
	onPlanUpdate: (plan: ScenePlan) => void;
	/** Called when messages change so the parent can persist them on the plan */
	onMessagesChange?: (messages: DirectorMessage[]) => void;
}

export function DirectorChat({ scenePlan, onPlanUpdate, onMessagesChange }: DirectorChatProps) {
	// Initialize from persisted history on the plan
	const [messages, setMessages] = useState<DirectorMessage[]>(() => {
		return (scenePlan?.directorHistory || []).map((m) => ({
			role: m.role,
			content: m.content,
		}));
	});
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [selectedModel, _setSelectedModel] = useState(() => (scenePlan as any)?.directorModel || "");
	const setSelectedModel = useCallback((model: string) => {
		_setSelectedModel(model);
		if (scenePlan) (scenePlan as any).directorModel = model;
	}, [scenePlan]);
	const [attachedImage, setAttachedImage] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Parse selected model into override
	const modelOverride = selectedModel
		? (() => {
				const [provider, model] = selectedModel.split(":");
				return { provider, model };
			})()
		: undefined;

	// Determine if current model supports images
	const activeProvider = modelOverride?.provider || "";
	const supportsImages = activeProvider ? VISION_PROVIDERS.has(activeProvider) : true; // default model might support it

	// Auto-scroll on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages.length]);

	// Persist messages to plan whenever they change
	useEffect(() => {
		if (messages.length > 0) {
			onMessagesChange?.(messages);
		}
	}, [messages, onMessagesChange]);

	// Focus input when not loading
	useEffect(() => {
		if (!isLoading) inputRef.current?.focus();
	}, [isLoading]);

	const handleImageAttach = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			toast.error("Only image files are supported");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			setAttachedImage(reader.result as string);
		};
		reader.readAsDataURL(file);
		// Reset so the same file can be re-selected
		e.target.value = "";
	}, []);

	const handleSend = useCallback(async () => {
		const text = input.trim();
		if (!text || isLoading || !scenePlan) return;

		const userMsg: DirectorMessage = {
			role: "user",
			content: text + (attachedImage ? "\n[Image attached]" : ""),
		};
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		const imageToSend = attachedImage;
		setAttachedImage(null);
		setIsLoading(true);

		const result = await refineScenePlan(scenePlan, text, messages, {
			modelOverride,
			imageBase64: imageToSend || undefined,
		});

		setIsLoading(false);

		if (result.error) {
			toast.error(result.error);
			const errMsg: DirectorMessage = {
				role: "director",
				content: result.response || `Something went wrong: ${result.error}`,
			};
			setMessages((prev) => [...prev, errMsg]);
			return;
		}

		const directorMsg: DirectorMessage = {
			role: "director",
			content: result.response,
			updatedPlan: result.updatedPlan,
		};
		setMessages((prev) => [...prev, directorMsg]);

		if (result.updatedPlan) {
			onPlanUpdate(result.updatedPlan);
		}
	}, [input, isLoading, scenePlan, messages, onPlanUpdate, modelOverride, attachedImage]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	if (!scenePlan) {
		return (
			<div className="flex items-center justify-center h-full text-white/20 text-[12px] p-4 text-center">
				Generate a video first, then use the Director to refine it.
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full">
			{/* Messages */}
			<div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
				{messages.length === 0 && (
					<div className="text-[11px] text-white/20 leading-relaxed mt-4">
						<div className="flex items-center gap-1.5 mb-3 text-amber-400/50">
							<Sparkles size={12} />
							<span className="font-medium">Creative Director</span>
						</div>
						<p className="mb-3">Tell me what to change about your video:</p>
						<div className="space-y-1.5 text-white/30">
							<p className="italic">"Make the hook more about autonomous task execution"</p>
							<p className="italic">"Scene 3 headline is too vague — make it punchier"</p>
							<p className="italic">"Add a metrics scene showing 40% time saved"</p>
							<p className="italic">"Cut scenes 7 and 8, they're redundant"</p>
							<p className="italic">"Make the whole video more confident in tone"</p>
						</div>
					</div>
				)}
				{messages.map((msg, i) => (
					<div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
						<div
							className={`max-w-[90%] rounded-lg px-3 py-2 text-[11px] leading-relaxed ${
								msg.role === "user"
									? "bg-[#2563eb]/20 text-[#93b5f7] border border-[#2563eb]/20"
									: "bg-white/[0.04] text-white/70 border border-white/5"
							}`}
						>
							{msg.content}
							{msg.updatedPlan && (
								<div className="mt-1.5 pt-1.5 border-t border-white/5 text-amber-400/50 text-[10px] flex items-center gap-1">
									<Sparkles size={10} />
									Plan updated — {msg.updatedPlan.scenes.length} scenes
								</div>
							)}
						</div>
					</div>
				))}
				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-white/[0.04] border border-white/5 rounded-lg px-3 py-2 text-[11px] text-white/40 flex items-center gap-2">
							<Loader2 size={12} className="animate-spin" />
							Director is thinking...
						</div>
					</div>
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* Cursor-style input container */}
			<div className="p-2">
				<div className="rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-amber-400/30 transition-colors overflow-hidden">
					{/* Attached image preview */}
					{attachedImage && (
						<div className="px-3 pt-2 flex items-center gap-2">
							<div className="relative">
								<img
									src={attachedImage}
									alt="Attached"
									className="h-12 rounded-md border border-white/10"
								/>
								<button
									onClick={() => setAttachedImage(null)}
									className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500/80 text-white flex items-center justify-center hover:bg-red-500"
								>
									<X size={10} />
								</button>
							</div>
							<span className="text-[10px] text-white/30">Image attached</span>
						</div>
					)}

					{/* Textarea — auto-grows with content, scrolls at max height */}
					<textarea
						ref={inputRef}
						value={input}
						onChange={(e) => {
							setInput(e.target.value);
							// Auto-resize: reset to 1-row then expand to scrollHeight
							const el = e.target;
							el.style.height = "auto";
							el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
						}}
						onKeyDown={handleKeyDown}
						disabled={isLoading}
						placeholder="Tell the Director what to change..."
						rows={1}
						style={{ maxHeight: 240 }}
						className="w-full px-3 py-2 bg-transparent text-[11px] text-white/70 placeholder:text-white/20 focus:outline-none resize-none disabled:opacity-40 overflow-y-auto"
					/>

					{/* Bottom bar: model selector + image + send */}
					<div className="flex items-center gap-1.5 px-2 pb-2">
						<select
							value={selectedModel}
							onChange={(e) => setSelectedModel(e.target.value)}
							title="AI model — try different models to compare output quality"
							className="text-[10px] bg-[#0e0e12] border border-white/10 rounded-md px-2 py-1 text-white/40 [&>option]:bg-[#141417] [&>option]:text-white hover:border-white/20 transition-colors"
						>
							<option value="">Default model</option>
							{AI_PROVIDERS.map((p) => (
								<optgroup key={p.id} label={p.name}>
									{p.models.map((m) => (
										<option key={`${p.id}:${m}`} value={`${p.id}:${m}`}>
											{m}
										</option>
									))}
								</optgroup>
							))}
						</select>

						<div className="flex-1" />

						{/* Image attach */}
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={handleFileChange}
						/>
						<button
							onClick={handleImageAttach}
							disabled={isLoading || !supportsImages}
							title={
								supportsImages
									? "Attach a screenshot or image"
									: "Selected model doesn't support images"
							}
							className="p-1.5 rounded-md text-white/25 hover:text-white/50 hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
						>
							<Image size={14} />
						</button>

						{/* Send */}
						<button
							onClick={handleSend}
							disabled={isLoading || !input.trim()}
							className="p-1.5 rounded-md bg-amber-500/15 text-amber-400/60 hover:bg-amber-500/25 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
							title="Send (Enter)"
						>
							<Send size={14} />
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
