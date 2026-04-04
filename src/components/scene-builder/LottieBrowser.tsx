// ── Lottie Browser ──────────────────────────────────────────────────────
//
// Search and browse LottieFiles animations. Download to local library.
// Renders as a panel within the Scenes tab or as a modal.

import { Download, Loader2, Search } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface LottieResult {
	id: string;
	name: string;
	imageUrl: string;
	lottieUrl: string;
	bgColor: string;
}

interface LottieBrowserProps {
	onSelect: (filename: string) => void;
}

export function LottieBrowser({ onSelect }: LottieBrowserProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<LottieResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [downloading, setDownloading] = useState<string | null>(null);

	const handleSearch = useCallback(async () => {
		if (!query.trim()) return;
		setLoading(true);
		try {
			const result = await window.electronAPI.lottieSearch(query.trim());
			if (result.error) {
				toast.error(result.error);
				setResults([]);
			} else {
				setResults(result.results);
				if (result.results.length === 0) {
					toast.info("No animations found");
				}
			}
		} catch {
			toast.error("Search failed");
		}
		setLoading(false);
	}, [query]);

	const handlePopular = useCallback(async () => {
		setLoading(true);
		try {
			const result = await window.electronAPI.lottiePopular();
			if (result.error) {
				toast.error(result.error);
			} else {
				setResults(result.results);
			}
		} catch {
			toast.error("Failed to load popular animations");
		}
		setLoading(false);
	}, []);

	const handleDownload = useCallback(
		async (item: LottieResult) => {
			setDownloading(item.id);
			try {
				const result = await window.electronAPI.lottieDownload(item.lottieUrl, item.name);
				if (result.success && result.filePath) {
					const filename = result.filePath.split(/[/\\]/).pop() || "";
					toast.success(`Downloaded: ${item.name}`);
					onSelect(filename);
				} else {
					toast.error(result.error || "Download failed");
				}
			} catch {
				toast.error("Download failed");
			}
			setDownloading(null);
		},
		[onSelect],
	);

	return (
		<div className="space-y-2">
			<div className="flex gap-1">
				<input
					type="text"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleSearch();
						e.stopPropagation();
					}}
					placeholder="Search LottieFiles..."
					className="flex-1 px-2 py-1.5 rounded bg-white/5 border border-white/10 text-[11px] text-white placeholder-white/25 focus:outline-none focus:border-[#2563eb]/50"
				/>
				<button
					onClick={handleSearch}
					disabled={loading}
					className="px-2 py-1.5 rounded bg-[#2563eb]/20 text-[#60a5fa] hover:bg-[#2563eb]/30 text-[11px] disabled:opacity-40"
				>
					{loading ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
				</button>
			</div>

			<button
				onClick={handlePopular}
				disabled={loading}
				className="w-full text-[10px] text-white/30 hover:text-white/50 py-1"
			>
				Browse popular animations
			</button>

			{/* Results grid */}
			{results.length > 0 && (
				<div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
					{results.map((item) => (
						<div
							key={item.id}
							className="rounded-lg border border-white/5 overflow-hidden hover:border-[#2563eb]/30 transition-colors cursor-pointer group"
							style={{ backgroundColor: item.bgColor || "#1a1a1a" }}
							onClick={() => handleDownload(item)}
						>
							{item.imageUrl && (
								<img
									src={item.imageUrl}
									alt={item.name}
									className="w-full h-20 object-contain"
									loading="lazy"
								/>
							)}
							<div className="px-1.5 py-1 bg-black/40 flex items-center justify-between">
								<span className="text-[9px] text-white/60 truncate">{item.name}</span>
								<button
									className="text-white/30 group-hover:text-[#60a5fa] transition-colors"
									title="Download & use"
								>
									{downloading === item.id ? (
										<Loader2 size={10} className="animate-spin" />
									) : (
										<Download size={10} />
									)}
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
