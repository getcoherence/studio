/**
 * DemoChatPanel — left panel with chat messages, prompt input, and history.
 */

import {
	ArrowDown,
	Bot,
	Check,
	History,
	Loader2,
	Mic,
	MousePointerClick,
	Navigation,
	Play,
	Square,
	Type,
	Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AISettingsButton } from "@/components/ui/AISettingsDialog";
import { DEMO_MODE_LIST, type DemoModeId } from "@/lib/ai/demoModes";
import { AI_PROVIDERS, type AIProvider, type AIServiceConfig } from "@/lib/ai/types";
import { getPromptHistory, type PromptHistoryEntry } from "./promptHistory";
import type { DemoAgentStatus, DemoChatMessage, DemoConfig } from "./types";

// ── Message renderers ─────────────────────────────────────────────────

// ── Inline audio player ───────────────────────────────────────────────

function NarrationAudioPlayer({ audioPath }: { audioPath: string }) {
	const [playing, setPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	function toggle() {
		if (!audioRef.current) {
			// Create audio element with file:// protocol for local paths
			const src = audioPath.startsWith("file://") ? audioPath : `file://${audioPath}`;
			audioRef.current = new Audio(src);
			audioRef.current.onended = () => setPlaying(false);
		}
		if (playing) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
			setPlaying(false);
		} else {
			audioRef.current.play().catch(() => setPlaying(false));
			setPlaying(true);
		}
	}

	return (
		<button
			onClick={toggle}
			className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors text-[10px]"
			title={playing ? "Stop" : "Play narration"}
		>
			{playing ? <Square size={10} /> : <Volume2 size={10} />}
			{playing ? "Stop" : "Play"}
		</button>
	);
}

function ChatMessage({
	msg,
	onOpenInEditor,
	onGenerateVoiceover,
	isGeneratingVoiceover,
}: {
	msg: DemoChatMessage;
	onOpenInEditor?: () => void;
	onGenerateVoiceover?: () => void;
	isGeneratingVoiceover?: boolean;
}) {
	switch (msg.type) {
		case "user-prompt":
			return (
				<div className="flex justify-end">
					<div className="max-w-[85%] px-3 py-2 rounded-lg bg-[#2563eb]/20 border border-[#2563eb]/20 text-sm text-white/90">
						{msg.content}
					</div>
				</div>
			);

		case "system":
			return (
				<div className="flex justify-center">
					<span className="text-[10px] text-white/30 px-3 py-1">{msg.content}</span>
				</div>
			);

		case "thinking":
			return (
				<div className="flex items-center gap-2 px-3 py-2">
					<Loader2 size={12} className="animate-spin text-[#2563eb]" />
					<span className="text-xs text-white/40">{msg.content}</span>
				</div>
			);

		case "action": {
			const icon =
				msg.actionType === "click" ? (
					<MousePointerClick size={12} />
				) : msg.actionType === "scroll" ? (
					<ArrowDown size={12} />
				) : msg.actionType === "type" ? (
					<Type size={12} />
				) : msg.actionType === "navigate" ? (
					<Navigation size={12} />
				) : null;

			return (
				<div className="flex items-center gap-2 px-3 py-1.5 mx-2 rounded-md bg-white/3 border border-white/5 text-xs text-white/50">
					{icon}
					<span>{msg.content}</span>
				</div>
			);
		}

		case "narration":
			return (
				<div className="flex gap-2 px-2">
					<Bot size={14} className="text-[#2563eb] mt-1 flex-shrink-0" />
					<div className="flex flex-col gap-2 min-w-0">
						<p className="text-sm text-white/80 leading-relaxed">{msg.content}</p>
						{msg.audioPath && <NarrationAudioPlayer audioPath={msg.audioPath} />}
						{msg.screenshotDataUrl && (
							<img
								src={msg.screenshotDataUrl}
								alt="Screenshot"
								className="w-full max-w-[280px] rounded-md border border-white/10 cursor-pointer hover:border-white/20 transition-colors"
							/>
						)}
					</div>
				</div>
			);

		case "storyboard":
			return (
				<div className="flex gap-2 px-2">
					<Bot size={14} className="text-purple-400 mt-1 flex-shrink-0" />
					<div className="flex flex-col gap-1 min-w-0 text-xs">
						{msg.content.split("\n").map((line, i) => (
							<span
								key={i}
								className={
									line.startsWith("📋")
										? "text-purple-300 font-medium text-sm"
										: line.match(/^\d+\./)
											? "text-white/60 pl-1"
											: "text-white/30"
								}
							>
								{line}
							</span>
						))}
					</div>
				</div>
			);

		case "pause":
			return (
				<div className="flex items-start gap-2 px-3 py-2 mx-2 rounded-md bg-amber-500/10 border border-amber-500/15 text-xs text-amber-300">
					<span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse mt-1 flex-shrink-0" />
					{msg.content}
				</div>
			);

		case "error":
			return (
				<div className="px-3 py-2 mx-2 rounded-md bg-red-500/10 border border-red-500/15 text-xs text-red-400">
					{msg.content}
				</div>
			);

		case "completion":
			return (
				<div className="flex flex-col gap-2 px-3 py-3 mx-2 rounded-md bg-emerald-500/8 border border-emerald-500/15">
					<div className="flex items-center gap-2 text-sm text-emerald-400 font-medium">
						<Check size={14} />
						{msg.content}
					</div>
					<div className="flex items-center gap-2">
						{onOpenInEditor && (
							<button
								onClick={onOpenInEditor}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#2563eb] hover:bg-[#2563eb]/90 text-white text-xs font-medium transition-colors"
							>
								Open in Editor
							</button>
						)}
						{onGenerateVoiceover && (
							<button
								onClick={onGenerateVoiceover}
								disabled={isGeneratingVoiceover}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-medium transition-colors disabled:opacity-40"
							>
								{isGeneratingVoiceover ? (
									<Loader2 size={12} className="animate-spin" />
								) : (
									<Mic size={12} />
								)}
								{isGeneratingVoiceover ? "Generating..." : "Generate Voiceover"}
							</button>
						)}
					</div>
				</div>
			);

		default:
			return null;
	}
}

// ── Panel ─────────────────────────────────────────────────────────────

interface DemoChatPanelProps {
	messages: DemoChatMessage[];
	status: DemoAgentStatus;
	onStart: (config: DemoConfig) => void;
	onOpenInEditor: () => void;
	onGenerateVoiceover?: () => void;
	isGeneratingVoiceover?: boolean;
}

/** Extract the first URL from a message string. */
function extractUrl(text: string): string | null {
	const match = text.match(/https?:\/\/[^\s,)]+/i);
	return match ? match[0] : null;
}

export function DemoChatPanel({
	messages,
	status,
	onStart,
	onOpenInEditor,
	onGenerateVoiceover,
	isGeneratingVoiceover,
}: DemoChatPanelProps) {
	const [input, setInput] = useState("");
	const [maxSteps, setMaxSteps] = useState(20);
	const [selectedMode, setSelectedMode] = useState<DemoModeId>("evangelist");
	const [history, setHistory] = useState<PromptHistoryEntry[]>([]);
	const [showHistory, setShowHistory] = useState(false);
	const [currentProvider, setCurrentProvider] = useState<AIProvider>("openai");
	const [currentModel, setCurrentModel] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const canSend = status === "idle" || status === "complete";
	const providerInfo = AI_PROVIDERS.find((p) => p.id === currentProvider);

	// Load prompt history + current AI config
	useEffect(() => {
		setHistory(getPromptHistory());
		window.electronAPI?.aiGetConfig?.().then((config: AIServiceConfig) => {
			setCurrentProvider(config.provider ?? "openai");
			setCurrentModel(config.model ?? "");
		});
	}, []);

	// Auto-scroll on new messages
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Focus input when idle
	useEffect(() => {
		if (canSend) inputRef.current?.focus();
	}, [canSend]);

	function handleSend() {
		const text = input.trim();
		if (!text || !canSend) return;

		const url = extractUrl(text);
		if (!url) return; // Need at least a URL

		// Everything that isn't the URL is the prompt
		const prompt = text
			.replace(url, "")
			.replace(/^[\s\-—:,]+|[\s\-—:,]+$/g, "")
			.trim();
		const finalPrompt = prompt || "Give a complete product demo, exploring the main features.";

		setInput("");
		setShowHistory(false);
		onStart({ url, prompt: finalPrompt, maxSteps, mode: selectedMode });
	}

	function handleHistorySelect(entry: PromptHistoryEntry) {
		setInput(`${entry.url} — ${entry.prompt}`);
		setShowHistory(false);
		inputRef.current?.focus();
	}

	async function handleModelChange(value: string) {
		// value is "provider:model" e.g. "openai:gpt-5.4-mini"
		const [provider, model] = value.split(":") as [AIProvider, string];
		setCurrentProvider(provider);
		setCurrentModel(model);
		await window.electronAPI?.aiSaveConfig?.({ provider, model });
	}

	return (
		<div className="flex flex-col h-full bg-[#0c0c0f]">
			{/* Messages */}
			<div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 select-text">
				{/* Agent greeting — always shown first when no messages */}
				{messages.length === 0 && (
					<div className="flex gap-2 px-2 pt-4">
						<Bot size={14} className="text-[#2563eb] mt-1 flex-shrink-0" />
						<div className="text-sm text-white/70 leading-relaxed">
							<p>What would you like to demo?</p>
							<p className="text-white/30 text-xs mt-1.5">
								Paste a URL and tell me what to show — e.g. "https://example.com walk through the
								features and end on pricing"
							</p>
						</div>
					</div>
				)}

				{messages.map((msg) => (
					<ChatMessage
						key={msg.id}
						msg={msg}
						onOpenInEditor={msg.type === "completion" ? onOpenInEditor : undefined}
						onGenerateVoiceover={msg.type === "completion" ? onGenerateVoiceover : undefined}
						isGeneratingVoiceover={msg.type === "completion" ? isGeneratingVoiceover : undefined}
					/>
				))}
				<div ref={messagesEndRef} />
			</div>

			{/* Input area — Cursor-style container */}
			<div className="p-3 bg-[#0c0c0f]">
				{canSend && (
					<>
						{/* Mode selector */}
						<div className="flex gap-1.5 mb-2">
							{DEMO_MODE_LIST.map((mode) => (
								<button
									key={mode.id}
									onClick={() => setSelectedMode(mode.id)}
									className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-[11px] transition-colors ${
										selectedMode === mode.id
											? "border-[#2563eb]/50 bg-[#2563eb]/10 text-[#60a5fa]"
											: "border-white/5 bg-white/[0.02] text-white/40 hover:text-white/60 hover:border-white/10"
									}`}
									title={mode.description}
								>
									<span>{mode.icon}</span>
									{mode.name}
								</button>
							))}
						</div>

						<div className="rounded-lg border border-white/10 bg-white/[0.03] focus-within:border-[#2563eb]/50 transition-colors overflow-hidden">
							{/* Textarea */}
							<textarea
								ref={inputRef}
								value={input}
								onChange={(e) => {
									setInput(e.target.value);
									const el = e.target;
									el.style.height = "auto";
									el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
								}}
								placeholder="https://example.com — walk through the main features..."
								rows={1}
								className="w-full px-3 pt-3 pb-2 text-sm text-white placeholder-white/20 bg-transparent resize-none focus:outline-none overflow-y-auto"
								style={{ maxHeight: 150 }}
								onKeyDown={(e) => {
									if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
										e.preventDefault();
										handleSend();
									}
								}}
							/>

							{/* Bottom toolbar inside the box */}
							<div className="flex items-center justify-between px-2 pb-2">
								<div className="flex items-center gap-2">
									<select
										value={`${currentProvider}:${currentModel || providerInfo?.defaultModel || ""}`}
										onChange={(e) => handleModelChange(e.target.value)}
										className="w-auto max-w-[160px] px-1.5 py-1 rounded bg-white/5 text-[10px] text-white/40 focus:outline-none cursor-pointer hover:text-white/60 transition-colors"
									>
										{AI_PROVIDERS.map((p) =>
											p.models.map((m) => (
												<option
													key={`${p.id}:${m}`}
													value={`${p.id}:${m}`}
													className="bg-[#18181b] text-white"
												>
													{m}
												</option>
											)),
										)}
									</select>

									<select
										value={maxSteps}
										onChange={(e) => setMaxSteps(Number(e.target.value))}
										className="px-1.5 py-1 rounded bg-white/5 text-[10px] text-white/40 focus:outline-none cursor-pointer hover:text-white/60 transition-colors"
									>
										<option value={12} className="bg-[#18181b] text-white">
											12 steps
										</option>
										<option value={20} className="bg-[#18181b] text-white">
											20 steps
										</option>
										<option value={30} className="bg-[#18181b] text-white">
											30 steps
										</option>
										<option value={40} className="bg-[#18181b] text-white">
											40 steps
										</option>
									</select>
								</div>

								<div className="flex items-center gap-1">
									{history.length > 0 && (
										<button
											onClick={() => setShowHistory(!showHistory)}
											className="p-1.5 text-white/25 hover:text-white/50 transition-colors rounded hover:bg-white/5"
											title="Recent prompts"
										>
											<History size={14} />
										</button>
									)}

									<AISettingsButton
										size={14}
										className="p-1.5 text-white/25 hover:text-white/50 transition-colors rounded hover:bg-white/5"
									/>

									<button
										onClick={handleSend}
										disabled={!extractUrl(input)}
										className="p-1.5 rounded-md bg-[#2563eb] hover:bg-[#2563eb]/90 text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
										title={`Start Demo (${navigator.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter)`}
									>
										<Play size={14} fill="currentColor" />
									</button>
								</div>
							</div>
						</div>

						{/* Prompt history dropdown */}
						{showHistory && history.length > 0 && (
							<div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
								{history.slice(0, 5).map((entry, i) => (
									<button
										key={`${entry.timestamp}-${i}`}
										onClick={() => handleHistorySelect(entry)}
										className="w-full text-left px-2.5 py-1.5 rounded-md bg-white/3 hover:bg-white/6 border border-white/5 transition-colors"
									>
										<div className="text-[10px] text-white/30 truncate">
											{new URL(entry.url).hostname}
										</div>
										<div className="text-xs text-white/50 truncate">{entry.prompt}</div>
									</button>
								))}
							</div>
						)}
					</>
				)}

				{/* Running state */}
				{status === "running" && (
					<div className="flex items-center justify-center gap-2 py-2 text-xs text-white/30">
						<Loader2 size={10} className="animate-spin" />
						Agent is exploring...
					</div>
				)}

				{status === "paused" && (
					<div className="flex items-center justify-center gap-2 py-2 text-xs text-amber-400/60">
						Waiting for you to complete authentication...
					</div>
				)}
			</div>
		</div>
	);
}
