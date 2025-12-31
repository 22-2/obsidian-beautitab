import { useMemo } from "react";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import logger from "src/Utils/logger";
import { validateCachedBackground } from "./utils";

/**
 * Hook to determine if cached background is usable
 * 
 * Returns true if cached background is valid for current settings and time,
 * meaning we don't need to fetch a new one.
 */
export const useCacheValidation = (
	settings: BeautitabPluginSettings,
	effectiveTime: Date,
	currentHour: number,
	currentDay: string
): boolean => {
	return useMemo(() => {
		// Always refetch if debug mode is on
		if (settings.debugRefreshBackgroundOnOpen) {
			logger.debug("Beautitab: Debug mode - forcing refresh");
			return false;
		}

		// No cached background available
		if (!settings.cachedBackground?.url) {
			logger.debug("Beautitab: No cached background available");
			return false;
		}

		// Validate the cached background
		const isValid = validateCachedBackground(
			settings.cachedBackground,
			settings,
			effectiveTime
		);

		logger.debug("Beautitab: Cache validation", {
			isValid,
			cachedTheme: settings.cachedBackground.theme,
			currentTheme: settings.backgroundTheme,
			cachedDate: settings.cachedBackground.date,
			effectiveTime: effectiveTime.toISOString(),
			currentHour,
			currentDay,
		});

		return isValid;
	}, [
		settings.debugRefreshBackgroundOnOpen,
		settings.cachedBackground,
		settings.backgroundTheme,
		settings.customBackground,
		settings.localBackgrounds,
		currentHour,
		currentDay,
		effectiveTime,
	]);
};
