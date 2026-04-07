// ── Pro Status Hook ─────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { activatePro, disconnectPro, getProStatus } from "./proLoader";

export function useProStatus() {
	const [status, setStatus] = useState(getProStatus());
	const [loading, setLoading] = useState(false);

	// Try to activate on mount (uses stored token if available)
	useEffect(() => {
		if (status === "unknown") {
			setLoading(true);
			activatePro().then(() => {
				setStatus(getProStatus());
				setLoading(false);
			});
		}
	}, []);

	const upgrade = useCallback(async () => {
		setLoading(true);
		const result = await activatePro();
		setStatus(getProStatus());
		setLoading(false);
		return result;
	}, []);

	const disconnect = useCallback(() => {
		disconnectPro();
		setStatus("inactive");
	}, []);

	return {
		isPro: status === "active",
		status,
		loading,
		upgrade,
		disconnect,
	};
}
