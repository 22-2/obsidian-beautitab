import { useEffect } from "react";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import BeautitabPlugin from "main";
import logger from "src/Utils/logger";
import { UseBackgroundResult } from "./background/types";
import { useEffectiveTime } from "./background/useEffectiveTime";
import { useCacheValidation } from "./background/useCacheValidation";
import { useBackgroundFetch } from "./background/useBackgroundFetch";
import { useBackgroundState, useBackgroundStyle } from "./background/useBackgroundState";
import { usePrefetch } from "./background/usePrefetch";

/**
 * Main hook for managing background display
 * 
 * This hook orchestrates:
 * - Time tracking for hour-based background changes
 * - Cache validation to determine if fetch is needed
 * - Background fetching from Unsplash or other sources
 * - Background state management
 * - Prefetching next hour's background
 */
export const useBackground = (
	settings: BeautitabPluginSettings,
	plugin: BeautitabPlugin
): UseBackgroundResult => {
	// Track effective time for background selection
	const { effectiveTime, currentHour, currentDay } = useEffectiveTime(settings);

	// Check if cached background is usable
	const isCachedUsable = useCacheValidation(
		settings,
		effectiveTime,
		currentHour,
		currentDay
	);

	// Fetch new background if needed
	const { fetchedBg, isSuccess, isLoading, isError, error, refetch } =
		useBackgroundFetch({
			settings,
			plugin,
			effectiveTime,
			enabled: !isCachedUsable,
		});

	// Log query state for debugging
	useEffect(() => {
		logger.debug("Beautitab: Query state", {
			isCachedUsable,
			isLoading,
			isSuccess,
			isError,
			error: error?.message,
			hasFetchedBg: !!fetchedBg,
		});
	}, [isCachedUsable, isLoading, isSuccess, isError, error, fetchedBg]);

	// Manage background state
	const { currentBg, isBackgroundVisible } = useBackgroundState({
		settings,
		plugin,
		effectiveTime,
		isCachedUsable,
		fetchedBg,
		refetch,
	});

	// Prefetch next hour's background
	usePrefetch({
		settings,
		plugin,
		currentBg,
	});

	// Generate CSS custom properties
	const backgroundStyle = useBackgroundStyle(currentBg, plugin);

	return {
		currentBg,
		isBackgroundVisible,
		backgroundStyle,
	};
};
