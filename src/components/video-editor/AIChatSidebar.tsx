/**
 * AIChatSidebar -- conversational AI sidebar for editing video via natural language.
 * Parses AI responses for JSON tool-call blocks and applies them to the editor.
 */
import { Loader2, MessageSquare, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import type { EditorState } from "@/hooks/useEditorHistory";
import { buildSystemPrompt, type ChatPromptContext } from "@/lib/ai/chatPrompt";
import { generatePolishEdits } from "@/lib/ai/oneClickPolish";
import { analyzeRecording } from "@/lib/ai/recordingAnalyzer";
import { generateTrimSuggestions } from "@/lib/ai/smartTrim";
import type { CaptionTrack, RecordingProfile } from "@/lib/ai/types";
import { VIDEO_EDITING_TOOLS } from "@/lib/ai/videoEditingTools";
import type {
	CursorTelemetryPoint,
	PlaybackSpeed,
	SpeedRegion,
	TrimRegion,
	ZoomDepth,
	ZoomRegion,
} from "./types";

// ── Types ──

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	toolCalls?: AppliedToolCall[];
	timestamp: number;
}

interface AppliedToolCall {
	tool: string;
	args: Record<string, unknown>;
	success: boolean;
	error?: string;
}

interface ToolCallPayload {
	tool: string;
	args: Record<string, unknown>;
}

// ── Props ──

interface AIChatSidebarProps {
	cursorTelemetry: CursorTelemetryPoint[];
	videoDurationMs: number;
	editorState: EditorState;
	onApplyEdits: (edits: Partial<EditorState>) => void;
	onSeek?: (timeMs: number) => void;
	onScreenshot?: () => Promise<void>;
	captionTrack: CaptionTrack | null;
	videoPath?: string | null;
}

// ── Helpers ──

const VALID_SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2];

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function nearestValidSpeed(input: number): PlaybackSpeed {
	let best: PlaybackSpeed = 1.5;
	let bestDist = Number.MAX_VALUE;
	for (const s of VALID_SPEEDS) {
		const d = Math.abs(input - s);
		if (d < bestDist) {
			bestDist = d;
			best = s;
		}
	}
	return best;
}

/**
 * Extract tool-call JSON blocks from an AI response string.
 * Looks for ```json ... ``` fenced blocks containing { "tool": ... }.
 */
function parseToolCalls(text: string): {
	plainText: string;
	toolCalls: ToolCallPayload[];
} {
	const toolCalls: ToolCallPayload[] = [];
	// Match fenced code blocks labelled json (or plain fenced blocks)
	const codeBlockRe = /```(?:json)?\s*\n?([\s\S]*?)```/g;
	let plainText = text;
	let match: RegExpExecArray | null;

	// biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
	while ((match = codeBlockRe.exec(text)) !== null) {
		const block = match[1].trim();
		try {
			const parsed = JSON.parse(block) as unknown;
			if (parsed && typeof parsed === "object" && "tool" in (parsed as Record<string, unknown>)) {
				const payload = parsed as ToolCallPayload;
				if (typeof payload.tool === "string") {
					toolCalls.push(payload);
					plainText = plainText.replace(match[0], "");
				}
			}
		} catch {
			// Not valid JSON -- leave in plain text
		}
	}

	return { plainText: plainText.trim(), toolCalls };
}

// ── Component ──

export function AIChatSidebar({
	cursorTelemetry,
	videoDurationMs,
	editorState,
	onApplyEdits,
	onSeek,
	onScreenshot,
	captionTrack,
	videoPath,
}: AIChatSidebarProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Auto-scroll to bottom when messages change
	useLayoutEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Auto-resize textarea
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
		}
	}, []);

	// Build recording profile (memoized)
	const recordingProfile = useMemo<RecordingProfile | null>(() => {
		if (cursorTelemetry.length === 0 || videoDurationMs <= 0) return null;
		return analyzeRecording(cursorTelemetry, videoDurationMs);
	}, [cursorTelemetry, videoDurationMs]);

	// Build caption text for context
	const captionText = useMemo(() => {
		if (!captionTrack) return undefined;
		return captionTrack.lines.map((line) => line.words.map((w) => w.text).join(" ")).join(" ");
	}, [captionTrack]);

	// Build system prompt context
	const systemPromptContext = useMemo<ChatPromptContext>(() => {
		return {
			durationSec: videoDurationMs / 1000,
			hasAudio: false, // We don't currently detect audio presence
			hasCaptions: captionTrack !== null,
			captionText,
			activeSegmentCount: recordingProfile?.activeSegments.length ?? 0,
			idleSegmentCount: recordingProfile?.idleSegments.length ?? 0,
			clickClusterCount: recordingProfile?.clickClusters.length ?? 0,
			currentSettings: {
				wallpaper: editorState.wallpaper,
				borderRadius: editorState.borderRadius,
				padding: editorState.padding,
				cursorStyle: editorState.cursorStyle,
				trimCount: editorState.trimRegions.length,
				zoomCount: editorState.zoomRegions.length,
				speedCount: editorState.speedRegions.length,
			},
		};
	}, [videoDurationMs, captionTrack, captionText, recordingProfile, editorState]);

	// ── Tool execution ──

	const executeTool = useCallback(
		(toolCall: ToolCallPayload): AppliedToolCall => {
			const { tool, args } = toolCall;
			const knownTool = VIDEO_EDITING_TOOLS.find((t) => t.name === tool);
			if (!knownTool) {
				return { tool, args, success: false, error: `Unknown tool: ${tool}` };
			}

			try {
				switch (tool) {
					case "addTrimRegion": {
						const startMs = Math.round((args.startSec as number) * 1000);
						const endMs = Math.round((args.endSec as number) * 1000);
						if (endMs <= startMs) {
							return {
								tool,
								args,
								success: false,
								error: "End time must be after start time",
							};
						}
						const trimRegion: TrimRegion = {
							id: `trim-ai-${uuidv4().slice(0, 8)}`,
							startMs: clamp(startMs, 0, videoDurationMs),
							endMs: clamp(endMs, 0, videoDurationMs),
						};
						onApplyEdits({
							trimRegions: [...editorState.trimRegions, trimRegion],
						});
						return { tool, args, success: true };
					}

					case "addZoomRegion": {
						const startMs = Math.round((args.startSec as number) * 1000);
						const endMs = Math.round((args.endSec as number) * 1000);
						const depth = clamp((args.depth as number) ?? 3, 1, 6) as ZoomDepth;
						if (endMs <= startMs) {
							return {
								tool,
								args,
								success: false,
								error: "End time must be after start time",
							};
						}
						const zoomRegion: ZoomRegion = {
							id: `zoom-ai-${uuidv4().slice(0, 8)}`,
							startMs: clamp(startMs, 0, videoDurationMs),
							endMs: clamp(endMs, 0, videoDurationMs),
							depth,
							focus: { cx: 0.5, cy: 0.5 },
						};
						onApplyEdits({
							zoomRegions: [...editorState.zoomRegions, zoomRegion],
						});
						return { tool, args, success: true };
					}

					case "addSpeedRegion": {
						const startMs = Math.round((args.startSec as number) * 1000);
						const endMs = Math.round((args.endSec as number) * 1000);
						const speed = nearestValidSpeed(args.speed as number);
						if (endMs <= startMs) {
							return {
								tool,
								args,
								success: false,
								error: "End time must be after start time",
							};
						}
						const speedRegion: SpeedRegion = {
							id: `speed-ai-${uuidv4().slice(0, 8)}`,
							startMs: clamp(startMs, 0, videoDurationMs),
							endMs: clamp(endMs, 0, videoDurationMs),
							speed,
						};
						onApplyEdits({
							speedRegions: [...editorState.speedRegions, speedRegion],
						});
						return { tool, args, success: true };
					}

					case "setBackground": {
						const wallpaperInput = String(args.wallpaper ?? "");
						let wallpaper: string;
						if (wallpaperInput === "none" || wallpaperInput === "") {
							wallpaper = "";
						} else if (/^\d+$/.test(wallpaperInput)) {
							const num = clamp(Number.parseInt(wallpaperInput, 10), 1, 18);
							wallpaper = `/wallpapers/wallpaper${num}.jpg`;
						} else if (wallpaperInput.startsWith("gradient")) {
							// Pass through gradient names
							wallpaper = wallpaperInput;
						} else {
							// Try to use as-is (could be a path)
							wallpaper = wallpaperInput;
						}
						onApplyEdits({ wallpaper });
						return { tool, args, success: true };
					}

					case "setBorderRadius": {
						const radius = clamp(Math.round(args.radius as number), 0, 48);
						onApplyEdits({ borderRadius: radius });
						return { tool, args, success: true };
					}

					case "setPadding": {
						const padding = clamp(Math.round(args.padding as number), 0, 100);
						onApplyEdits({ padding });
						return { tool, args, success: true };
					}

					case "generateCaptions": {
						// Run asynchronously -- fire and forget
						const sourcePath = videoPath ?? null;
						if (!sourcePath) {
							return {
								tool,
								args,
								success: false,
								error: "No video loaded",
							};
						}
						// Strip file:// prefix if present
						const cleanPath = sourcePath.replace(/^file:\/\//, "");
						window.electronAPI
							.whisperTranscribe(cleanPath, {
								modelId: "base",
							})
							.then((result) => {
								if (result.success && result.captionTrack) {
									onApplyEdits({
										captionTrack: result.captionTrack,
									});
									toast.success(`Captions generated: ${result.captionTrack.lines.length} lines`);
								} else {
									toast.error(result.error || "Caption generation failed");
								}
							})
							.catch((err: unknown) => {
								toast.error(`Caption error: ${err instanceof Error ? err.message : String(err)}`);
							});
						return { tool, args, success: true };
					}

					case "smartTrim": {
						if (!recordingProfile) {
							return {
								tool,
								args,
								success: false,
								error: "No cursor telemetry available",
							};
						}
						const suggestions = generateTrimSuggestions(recordingProfile, videoDurationMs);
						if (suggestions.length === 0) {
							return {
								tool,
								args,
								success: false,
								error: "No trimmable sections detected",
							};
						}
						const newTrims: TrimRegion[] = suggestions.map((s) => ({
							id: s.id,
							startMs: s.startMs,
							endMs: s.endMs,
						}));
						onApplyEdits({
							trimRegions: [...editorState.trimRegions, ...newTrims],
						});
						return { tool, args, success: true };
					}

					case "magicPolish": {
						if (cursorTelemetry.length === 0 || videoDurationMs <= 0) {
							return {
								tool,
								args,
								success: false,
								error: "No telemetry data for polish",
							};
						}
						const result = generatePolishEdits({
							cursorTelemetry,
							videoDurationMs,
							currentState: editorState,
						});
						onApplyEdits(result.edits);
						return { tool, args, success: true };
					}

					case "setCursorStyle": {
						const style = String(args.style ?? "default");
						const validStyles = ["default", "dot", "crosshair", "ring"];
						onApplyEdits({
							cursorStyle: validStyles.includes(style) ? style : "default",
						});
						return { tool, args, success: true };
					}

					case "setCursorEffects": {
						const updates: Partial<EditorState> = {};
						if (args.smoothing !== undefined) {
							updates.cursorSmoothing = clamp(args.smoothing as number, 0, 1);
						}
						if (args.sway !== undefined) {
							updates.cursorSway = clamp(args.sway as number, 0, 1);
						}
						if (args.showClickRings !== undefined) {
							updates.showClickRings = Boolean(args.showClickRings);
						}
						onApplyEdits(updates);
						return { tool, args, success: true };
					}

					case "seekTo": {
						const timeSec = args.timeSec as number;
						if (onSeek) {
							onSeek(clamp(timeSec, 0, videoDurationMs / 1000) * 1000);
						}
						return { tool, args, success: true };
					}

					case "addTextAnnotation": {
						const ann = {
							id: `ann-${crypto.randomUUID().slice(0, 8)}`,
							startMs: Math.round(((args.startSec as number) || 0) * 1000),
							endMs: Math.round(((args.endSec as number) || 5) * 1000),
							type: "text" as const,
							content: (args.text as string) || "Text",
							textContent: (args.text as string) || "Text",
							position: { x: (args.x as number) ?? 50, y: (args.y as number) ?? 20 },
							size: { width: 40, height: 15 },
							style: {
								color: (args.color as string) || "#ffffff",
								backgroundColor: "rgba(0,0,0,0.6)",
								fontSize: (args.fontSize as number) || 32,
								fontFamily: "Inter, sans-serif",
								fontWeight: "bold" as const,
								fontStyle: "normal" as const,
								textDecoration: "none" as const,
								textAlign: "center" as const,
							},
							zIndex: (editorState.annotationRegions?.length || 0) + 1,
						};
						onApplyEdits({
							annotationRegions: [...(editorState.annotationRegions || []), ann],
						});
						return { tool, args, success: true };
					}

					case "addArrowAnnotation": {
						const arrow = {
							id: `ann-${crypto.randomUUID().slice(0, 8)}`,
							startMs: Math.round(((args.startSec as number) || 0) * 1000),
							endMs: Math.round(((args.endSec as number) || 5) * 1000),
							type: "figure" as const,
							content: "",
							position: { x: (args.x as number) ?? 50, y: (args.y as number) ?? 50 },
							size: { width: 10, height: 15 },
							style: {
								color: "#ffffff",
								backgroundColor: "transparent",
								fontSize: 32,
								fontFamily: "Inter, sans-serif",
								fontWeight: "normal" as const,
								fontStyle: "normal" as const,
								textDecoration: "none" as const,
								textAlign: "center" as const,
							},
							zIndex: (editorState.annotationRegions?.length || 0) + 1,
							figureData: {
								arrowDirection: ((args.direction as string) || "down") as
									| "up"
									| "down"
									| "left"
									| "right"
									| "up-right"
									| "up-left"
									| "down-right"
									| "down-left",
								color: (args.color as string) || "#ef4444",
								strokeWidth: 3,
							},
						};
						onApplyEdits({
							annotationRegions: [...(editorState.annotationRegions || []), arrow],
						});
						return { tool, args, success: true };
					}

					case "clearAnnotations": {
						onApplyEdits({ annotationRegions: [] });
						return { tool, args, success: true };
					}

					case "takeScreenshot": {
						if (onScreenshot) {
							void onScreenshot();
						}
						return { tool, args, success: true };
					}

					default:
						return {
							tool,
							args,
							success: false,
							error: `Unhandled tool: ${tool}`,
						};
				}
			} catch (err) {
				return {
					tool,
					args,
					success: false,
					error: err instanceof Error ? err.message : String(err),
				};
			}
		},
		[
			editorState,
			videoDurationMs,
			cursorTelemetry,
			recordingProfile,
			onApplyEdits,
			onSeek,
			onScreenshot,
			videoPath,
		],
	);

	// ── Send message ──

	const sendMessage = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed || isLoading) return;

		const userMessage: ChatMessage = {
			id: uuidv4(),
			role: "user",
			content: trimmed,
			timestamp: Date.now(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		try {
			// Build conversation for the AI
			const systemPrompt = buildSystemPrompt(systemPromptContext);

			// Build the full prompt: system + conversation history + new message
			const conversationParts: string[] = [systemPrompt, ""];

			// Include recent conversation history (last 10 messages)
			const recentMessages = [...messages, userMessage].slice(-10);
			for (const msg of recentMessages) {
				const prefix = msg.role === "user" ? "User" : "Assistant";
				conversationParts.push(`${prefix}: ${msg.content}`);
			}

			const fullPrompt = conversationParts.join("\n");

			const result = await window.electronAPI.aiAnalyze(fullPrompt);

			if (!result.success || !result.text) {
				const errorMsg: ChatMessage = {
					id: uuidv4(),
					role: "assistant",
					content:
						result.error ||
						"Sorry, I could not process that request. Please check your AI settings.",
					timestamp: Date.now(),
				};
				setMessages((prev) => [...prev, errorMsg]);
				return;
			}

			// Parse tool calls from the response
			const { plainText, toolCalls } = parseToolCalls(result.text);

			// Execute tool calls
			const appliedCalls: AppliedToolCall[] = [];
			for (const tc of toolCalls) {
				const applied = executeTool(tc);
				appliedCalls.push(applied);
			}

			const assistantMessage: ChatMessage = {
				id: uuidv4(),
				role: "assistant",
				content: plainText || (appliedCalls.length > 0 ? "Done." : ""),
				toolCalls: appliedCalls.length > 0 ? appliedCalls : undefined,
				timestamp: Date.now(),
			};

			setMessages((prev) => [...prev, assistantMessage]);
		} catch (err) {
			const errorMsg: ChatMessage = {
				id: uuidv4(),
				role: "assistant",
				content: `Error: ${err instanceof Error ? err.message : String(err)}`,
				timestamp: Date.now(),
			};
			setMessages((prev) => [...prev, errorMsg]);
		} finally {
			setIsLoading(false);
		}
	}, [input, isLoading, messages, systemPromptContext, executeTool]);

	// ── Keyboard handling ──

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		},
		[sendMessage],
	);

	return (
		<div className="h-full flex flex-col bg-[#09090b] rounded-b-2xl border border-t-0 border-white/5 shadow-lg overflow-hidden">
			{/* Header */}
			<div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/5">
				<MessageSquare size={14} className="text-[#2563eb]" />
				<span className="text-xs font-semibold text-white/90">AI Chat</span>
				<span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-[#2563eb]/20 text-[#2563eb]">
					Cursor for Video
				</span>
			</div>

			{/* Messages list */}
			<div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
				{messages.length === 0 && (
					<div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
						<Sparkles size={24} className="text-white/20" />
						<div className="text-[11px] text-white/30 max-w-[200px] leading-relaxed">
							Ask me to edit your video. Try:
							<br />
							<span className="text-white/50 italic">"Trim the boring parts"</span>
							<br />
							<span className="text-white/50 italic">"Add zoom at 0:15"</span>
							<br />
							<span className="text-white/50 italic">"Speed up 5s to 12s at 2x"</span>
							<br />
							<span className="text-white/50 italic">"Apply magic polish"</span>
						</div>
					</div>
				)}

				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
					>
						<div
							className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
								msg.role === "user" ? "bg-[#2563eb]/20 text-white/90" : "bg-white/5 text-white/80"
							}`}
						>
							{/* Message text */}
							{msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}

							{/* Tool call chips */}
							{msg.toolCalls && msg.toolCalls.length > 0 && (
								<div className="flex flex-wrap gap-1 mt-1.5">
									{msg.toolCalls.map((tc, i) => (
										<span
											key={`${msg.id}-tool-${i}`}
											className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
												tc.success
													? "bg-emerald-500/20 text-emerald-400"
													: "bg-red-500/20 text-red-400"
											}`}
										>
											{tc.success ? "\u2713" : "\u2717"} {tc.tool}
											{tc.error && <span className="text-red-300/60 ml-0.5">({tc.error})</span>}
										</span>
									))}
								</div>
							)}
						</div>
					</div>
				))}

				{/* Loading indicator */}
				{isLoading && (
					<div className="flex justify-start">
						<div className="bg-white/5 rounded-xl px-3 py-2 text-[11px] text-white/50 flex items-center gap-2">
							<Loader2 size={12} className="animate-spin" />
							Thinking...
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Input area */}
			<div className="border-t border-white/5 p-2">
				<div className="flex items-end gap-1.5">
					<textarea
						ref={textareaRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask AI to edit your video..."
						rows={1}
						className="flex-1 resize-none rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[11px] text-white/90 placeholder-white/30 focus:outline-none focus:border-[#2563eb]/40 transition-colors"
						disabled={isLoading}
					/>
					<button
						type="button"
						onClick={sendMessage}
						disabled={isLoading || !input.trim()}
						className="flex-shrink-0 p-2 rounded-lg bg-[#2563eb]/20 hover:bg-[#2563eb]/30 text-[#2563eb] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
					>
						<Send size={14} />
					</button>
				</div>
			</div>
		</div>
	);
}
