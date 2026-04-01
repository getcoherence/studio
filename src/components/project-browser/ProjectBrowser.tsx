import { FileText, FolderOpen, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface RecentProject {
	filePath: string;
	fileName: string;
	lastModified: number;
	fileSize: number;
}

interface ProjectBrowserProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onProjectOpened?: () => void;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	if (diffDays < 7) return `${diffDays} days ago`;

	return date.toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function ProjectBrowser({ open, onOpenChange, onProjectOpened }: ProjectBrowserProps) {
	const [projects, setProjects] = useState<RecentProject[]>([]);
	const [loading, setLoading] = useState(false);
	const [contextMenuIdx, setContextMenuIdx] = useState<number | null>(null);

	const loadProjects = useCallback(async () => {
		if (!window.electronAPI?.getRecentProjects) return;
		setLoading(true);
		try {
			const result = await window.electronAPI.getRecentProjects();
			setProjects(result);
		} catch {
			// Ignore load errors
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (open) {
			loadProjects();
			setContextMenuIdx(null);
		}
	}, [open, loadProjects]);

	const handleOpen = useCallback(
		async (filePath: string) => {
			await window.electronAPI.setCurrentVideoPath?.(filePath);
			onOpenChange(false);
			onProjectOpened?.();
		},
		[onOpenChange, onProjectOpened],
	);

	const handleOpenFile = useCallback(async () => {
		const result = await window.electronAPI.loadProjectFile();
		if (result.success) {
			onOpenChange(false);
			onProjectOpened?.();
		}
	}, [onOpenChange, onProjectOpened]);

	const handleRemove = useCallback(async (filePath: string) => {
		await window.electronAPI.removeRecentProject?.(filePath);
		setProjects((prev) => prev.filter((p) => p.filePath !== filePath));
		setContextMenuIdx(null);
	}, []);

	const handleReveal = useCallback((filePath: string) => {
		window.electronAPI.revealInFolder?.(filePath);
		setContextMenuIdx(null);
	}, []);

	const handleContextMenu = useCallback((e: React.MouseEvent, idx: number) => {
		e.preventDefault();
		setContextMenuIdx((prev) => (prev === idx ? null : idx));
	}, []);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="bg-[#09090b] border-white/10 text-white max-w-[480px] max-h-[70vh] flex flex-col">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-sm">
						<FolderOpen className="w-4 h-4 text-[#2563eb]" />
						Recent Projects
					</DialogTitle>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto min-h-0 -mx-2">
					{loading && <div className="text-center py-8 text-slate-500 text-sm">Loading...</div>}

					{!loading && projects.length === 0 && (
						<div className="text-center py-12">
							<FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
							<p className="text-slate-400 text-sm mb-1">No recent projects</p>
							<p className="text-slate-500 text-xs mb-4">Open a project file to get started</p>
							<Button
								size="sm"
								className="bg-[#2563eb] hover:bg-[#2d9e6c] text-white"
								onClick={handleOpenFile}
							>
								<FolderOpen className="w-3.5 h-3.5 mr-1.5" />
								Open Project
							</Button>
						</div>
					)}

					{!loading &&
						projects.map((project, idx) => (
							<div key={project.filePath} className="relative">
								<button
									type="button"
									onClick={() => handleOpen(project.filePath)}
									onContextMenu={(e) => handleContextMenu(e, idx)}
									className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
								>
									<FileText className="w-5 h-5 text-slate-400 shrink-0" />
									<div className="flex-1 min-w-0">
										<p className="text-sm text-slate-200 truncate">{project.fileName}</p>
										<div className="flex items-center gap-2 text-[11px] text-slate-500">
											<span>{formatDate(project.lastModified)}</span>
											<span className="text-slate-600">|</span>
											<span>{formatFileSize(project.fileSize)}</span>
										</div>
									</div>
								</button>

								{/* Context menu */}
								{contextMenuIdx === idx && (
									<div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl py-1 min-w-[160px]">
										<button
											type="button"
											onClick={() => handleReveal(project.filePath)}
											className="w-full px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 text-left transition-colors"
										>
											Reveal in Folder
										</button>
										<button
											type="button"
											onClick={() => handleRemove(project.filePath)}
											className="w-full px-3 py-1.5 text-xs text-red-400 hover:bg-white/5 text-left transition-colors flex items-center gap-1.5"
										>
											<Trash2 className="w-3 h-3" />
											Remove from Recent
										</button>
									</div>
								)}
							</div>
						))}
				</div>

				<DialogFooter className="flex gap-2 sm:justify-between mt-2">
					<div />
					<Button
						size="sm"
						variant="ghost"
						className="text-slate-400 hover:text-white gap-1.5"
						onClick={handleOpenFile}
					>
						<FolderOpen className="w-3.5 h-3.5" />
						Open Other...
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
