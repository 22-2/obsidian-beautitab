import { useState, useEffect, useMemo } from "react";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import logger from "src/Utils/logger";
import { HOUR_CHECK_INTERVAL } from "./constants";

/**
 * Hook to track effective time for background switching
 * 
 * When refreshBackgroundOnHourChange is enabled, this hook polls for hour
 * changes and updates the effective time accordingly. Otherwise, it uses
 * the mount time (static).
 */
export const useEffectiveTime = (settings: BeautitabPluginSettings) => {
	const mountTime = useMemo(() => new Date(), []);
	const [currentTime, setCurrentTime] = useState(() => new Date());

	// Poll for hour changes when enabled
	useEffect(() => {
		if (!settings.refreshBackgroundOnHourChange) return;

		const checkInterval = setInterval(() => {
			setCurrentTime((prev) => {
				const now = new Date();
				if (now.getHours() !== prev.getHours()) {
					logger.info("Beautitab: Hour changed, updating background", {
						from: prev.getHours(),
						to: now.getHours(),
					});
					return now;
				}
				return prev;
			});
		}, HOUR_CHECK_INTERVAL);

		return () => clearInterval(checkInterval);
	}, [settings.refreshBackgroundOnHourChange]);

	const effectiveTime = settings.refreshBackgroundOnHourChange
		? currentTime
		: mountTime;

	return {
		effectiveTime,
		currentHour: effectiveTime.getHours(),
		currentDay: effectiveTime.toDateString(),
	};
};
