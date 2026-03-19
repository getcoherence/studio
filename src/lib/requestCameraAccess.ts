export type CameraAccessResult = {
	success: boolean;
	granted: boolean;
	status: string;
	error?: string;
};

function getDeniedStatus(error: unknown) {
	if (error instanceof DOMException) {
		return error.name;
	}

	return "unknown";
}

export async function requestCameraAccess(): Promise<CameraAccessResult> {
	if (window.electronAPI?.requestCameraAccess) {
		const electronResult = await window.electronAPI.requestCameraAccess();
		if (!electronResult.success || !electronResult.granted) {
			return electronResult;
		}
	}

	if (!navigator.mediaDevices?.getUserMedia) {
		return {
			success: false,
			granted: false,
			status: "unsupported",
			error: "Camera access is not supported in this runtime.",
		};
	}

	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: true,
		});
		stream.getTracks().forEach((track) => track.stop());
		return { success: true, granted: true, status: "granted" };
	} catch (error) {
		return {
			success: true,
			granted: false,
			status: getDeniedStatus(error),
			error: String(error),
		};
	}
}
