import { useState, useEffect, useRef, useMemo } from "react";
import BeautitabPlugin from "main";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { CachedBackground } from "src/Types/Interfaces";
import logger from "src/Utils/logger";
import {
	resolveUrl,
	preloadImage,
	checkFileExists,
	getInitialBackground,
} from "./utils";

interface UseBackgroundStateOptions {
	settings: BeautitabPluginSettings;
	plugin: BeautitabPlugin;
	effectiveTime: Date;
	isCachedUsable: boolean;
	fetchedBg: CachedBackground | null | undefined;
	refetch: () => void;
}

interface UseBackgroundStateResult {
	currentBg: CachedBackground | null;
	isBackgroundVisible: boolean;
}

/**
 * Hook to manage current background state
 * Handles initialization, updates, file existence validation, and persistence
 */
export const useBackgroundState = ({
	settings,
	plugin,
	effectiveTime,
	isCachedUsable,
	fetchedBg,
	refetch,
}: UseBackgroundStateOptions): UseBackgroundStateResult => {
	// Initialize with valid background or null
	const [currentBg, setCurrentBg] = useState<CachedBackground | null>(() =>
		getInitialBackground(settings, effectiveTime)
	);
	const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);

	// Ref to track if background has been shown
	const hasShownBackgroundRef = useRef(false);

	// Verify file existence for cached background
	useEffect(() => {
		const verify = async () => {
			if (!currentBg?.url) return;

			const exists = await checkFileExists(currentBg.url, plugin);
			if (!exists) {
				logger.warn("Beautitab: Cached background file missing, refetching...");
				setCurrentBg(null);
				plugin.settings.cachedBackground = undefined;
				await plugin.saveSettings();
				void refetch();
			}
		};
		void verify();
	}, [plugin, refetch, currentBg?.url]);

	// Handle background updates (no crossfade - immediate switch)
	useEffect(() => {
		const bg = isCachedUsable ? settings.cachedBackground : fetchedBg;
		if (!bg?.url) return;

		let cancelled = false;

		const updateBackground = async () => {
			const resolvedUrl = resolveUrl(bg.url, plugin);

			// Check if file exists before preloading
			const exists = await checkFileExists(bg.url, plugin);
			if (!exists) {
				logger.warn(
					"Beautitab: Background file missing during update, refetching..."
				);
				void refetch();
				return;
			}

			await preloadImage(resolvedUrl);

			if (cancelled) return;

			// Set the new background immediately
			setCurrentBg(bg);
		};

		void updateBackground();

		return () => {
			cancelled = true;
		};
	}, [isCachedUsable, settings.cachedBackground, fetchedBg, plugin, refetch]);

	// Handle visibility animation (fade in on first load)
	useEffect(() => {
		if (!currentBg?.url) return;

		if (!hasShownBackgroundRef.current) {
			hasShownBackgroundRef.current = true;
			requestAnimationFrame(() => setIsBackgroundVisible(true));
			return;
		}

		setIsBackgroundVisible(true);
	}, [currentBg?.url]);

	// Persist current background to settings
	useEffect(() => {
		if (settings.debugRefreshBackgroundOnOpen || !currentBg) return;

		const isSameAsCached =
			currentBg.url === settings.cachedBackground?.url &&
			currentBg.theme === settings.cachedBackground?.theme;

		if (isSameAsCached) return;

		plugin.settings.cachedBackground = currentBg;
		void plugin.saveSettings();
	}, [currentBg, settings.cachedBackground, settings.debugRefreshBackgroundOnOpen, plugin]);

	return {
		currentBg,
		isBackgroundVisible,
	};
};

/**
 * Generate CSS custom properties for background URL
 */
export const useBackgroundStyle = (
	currentBg: CachedBackground | null,
	plugin: BeautitabPlugin
): Record<string, string> & React.CSSProperties => {
	return useMemo(() => {
		const style: Record<string, string> & React.CSSProperties = {};

		if (currentBg?.url) {
			style["--beautitab-bg-url-current"] = `url("${resolveUrl(
				currentBg.url,
				plugin
			)}")`;
		}

		return style;
	}, [currentBg?.url, plugin]);
};
