/**
 * IPC handlers for AI Demo Recorder.
 * Runs the DemoAgent in the main process and sends progress events to the renderer.
 */

import { BrowserWindow, ipcMain } from "electron";
import { DemoAgent, type DemoConfig, type DemoStep } from "../automation/demoAgent";

let activeAgent: DemoAgent | null = null;
let isRunning = false;

/** Serialize a DemoStep for IPC (convert Buffer screenshots to base64 data URLs). */
function serializeStep(step: DemoStep): SerializedDemoStep {
	return {
		action: step.action,
		timestamp: step.timestamp,
		screenshotDataUrl: step.screenshot
			? `data:image/png;base64,${step.screenshot.toString("base64")}`
			: undefined,
	};
}

export interface SerializedDemoStep {
	action: DemoStep["action"];
	timestamp: number;
	screenshotDataUrl?: string;
}

export interface SerializedDemoResult {
	steps: SerializedDemoStep[];
	totalDurationMs: number;
	narrationText: string;
}

export function registerDemoHandlers(getMainWindow: () => BrowserWindow | null): void {
	ipcMain.handle(
		"demo-start",
		async (_event, config: DemoConfig): Promise<SerializedDemoResult> => {
			if (isRunning) {
				throw new Error("A demo is already running");
			}

			isRunning = true;

			const mainWindow = getMainWindow();

			activeAgent = new DemoAgent((step: DemoStep, stepIndex: number) => {
				// Send progress events to the renderer
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.webContents.send("demo-progress", {
						step: serializeStep(step),
						stepIndex,
					});
				}
			});

			try {
				const result = await activeAgent.run(config);

				const serialized: SerializedDemoResult = {
					steps: result.steps.map(serializeStep),
					totalDurationMs: result.totalDurationMs,
					narrationText: result.narrationText,
				};

				return serialized;
			} finally {
				activeAgent = null;
				isRunning = false;
			}
		},
	);

	ipcMain.handle("demo-stop", async () => {
		if (activeAgent) {
			await activeAgent.stop();
			activeAgent = null;
			isRunning = false;
		}
		return { success: true };
	});

	ipcMain.handle("demo-resume", () => {
		if (activeAgent) {
			activeAgent.resume();
		}
		return { success: true };
	});

	ipcMain.handle("demo-get-status", () => {
		return { running: isRunning };
	});
}
