import { useEffect, useState } from "react";
import { RecordingBar } from "./components/recording/RecordingBar";
import { Toaster } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { UpdateToast } from "./components/ui/UpdateToast";
import { ShortcutsConfigDialog } from "./components/video-editor/ShortcutsConfigDialog";
import VideoEditor from "./components/video-editor/VideoEditor";
import { ShortcutsProvider } from "./contexts/ShortcutsContext";
import { loadAllCustomFonts } from "./lib/customFonts";

export default function App() {
	const [windowType, setWindowType] = useState("");

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const type = params.get("windowType") || "";
		setWindowType(type);
		if (type === "recording-bar") {
			document.body.style.background = "transparent";
			document.documentElement.style.background = "transparent";
			document.getElementById("root")?.style.setProperty("background", "transparent");
		}

		// Load custom fonts on app initialization
		loadAllCustomFonts().catch((error) => {
			console.error("Failed to load custom fonts:", error);
		});
	}, []);

	const content = (() => {
		switch (windowType) {
			case "recording-bar":
				return <RecordingBar />;
			case "editor":
			default:
				return (
					<ShortcutsProvider>
						<VideoEditor />
						<ShortcutsConfigDialog />
					</ShortcutsProvider>
				);
		}
	})();

	return (
		<TooltipProvider>
			{content}
			{windowType !== "recording-bar" && <UpdateToast />}
			<Toaster theme="dark" className="pointer-events-auto" />
		</TooltipProvider>
	);
}
