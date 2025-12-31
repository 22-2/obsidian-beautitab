import { useState, useEffect, useRef, useMemo } from "react";
import BeautitabPlugin from "main";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { CachedBackground } from "src/Types/Interfaces";
import logger from "src/Utils/logger";
import { CROSSFADE_DURATION } from "./constants";
import {
	resolveUrl,
	preloadImage,
	checkFileExists,
	getInitialBackground,
} from "./utils";

interface UseCrossfadeOptions {
	settings: BeautitabPluginSettings;
	plugin: BeautitabPlugin;
	effectiveTime: Date;
	isCachedUsable: boolean;
	fetchedBg: CachedBackground | null | undefined;
	refetch: () => void;
}

interface UseCrossfadeResult {
	currentBg: CachedBackground | null;
	incomingBg: CachedBackground | null;
	isBackgroundVisible: boolean;
	isCrossfading: boolean;
}

/**
 * Hook to manage crossfade animation between backgrounds
 */
export const useCrossfade = ({
	settings,
	plugin,
	effectiveTime,
	isCachedUsable,
	fetchedBg,
	refetch,
}: UseCrossfadeOptions): UseCrossfadeResult => {
	// Initialize with valid background or null
	const [currentBg, setCurrentBg] = useState<CachedBackground | null>(() =>
		getInitialBackground(settings, effectiveTime)
	);
	const [incomingBg, setIncomingBg] = useState<CachedBackground | null>(null);
	const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);
	const [isCrossfading, setIsCrossfading] = useState(false);

	// Refs for stable references
	const currentBgRef = useRef<CachedBackground | null>(null);
	const hasShownBackgroundRef = useRef(false);

	// Keep ref in sync
	useEffect(() => {
		currentBgRef.current = currentBg;
	}, [currentBg]);

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

	// Handle background updates with crossfade
	useEffect(() => {
		const bg = isCachedUsable ? settings.cachedBackground : fetchedBg;
		if (!bg?.url) return;

		let cancelled = false;
		let timeoutId: number | undefined;

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

			const prev = currentBgRef.current;

			// Initial background - no crossfade needed
			if (!prev?.url) {
				setCurrentBg(bg);
				return;
			}

			// Same URL - no update needed
			if (prev.url === bg.url) return;

			// Initiate crossfade
			setIncomingBg(bg);
			requestAnimationFrame(() => {
				if (!cancelled) setIsCrossfading(true);
			});

			// Complete crossfade after duration
			timeoutId = window.setTimeout(() => {
				if (cancelled) return;
				setCurrentBg(bg);
				setIncomingBg(null);
				setIsCrossfading(false);
			}, CROSSFADE_DURATION);
		};

		void updateBackground();

		return () => {
			cancelled = true;
			if (timeoutId) window.clearTimeout(timeoutId);
		};
	}, [isCachedUsable, settings.cachedBackground, fetchedBg, plugin, refetch]);

	// Handle visibility animation
	useEffect(() => {
		if (!currentBg?.url && !incomingBg?.url) return;

		if (!hasShownBackgroundRef.current) {
			hasShownBackgroundRef.current = true;
			requestAnimationFrame(() => setIsBackgroundVisible(true));
			return;
		}

		setIsBackgroundVisible(true);
	}, [currentBg?.url, incomingBg?.url]);

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
		incomingBg,
		isBackgroundVisible,
		isCrossfading,
	};
};

/**
 * Generate CSS custom properties for background URLs
 */
export const useBackgroundStyle = (
	currentBg: CachedBackground | null,
	incomingBg: CachedBackground | null,
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

		if (incomingBg?.url) {
			style["--beautitab-bg-url-next"] = `url("${resolveUrl(
				incomingBg.url,
				plugin
			)}")`;
		}

		return style;
	}, [currentBg?.url, incomingBg?.url, plugin]);
};
