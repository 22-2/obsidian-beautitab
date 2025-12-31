import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import BeautitabPlugin from "main";
import logger from "src/Utils/logger";
import { BackgroundTheme } from "React/Components/App/hooks/background/types";
import React from "react";

// ============================================================================
// Types
// ============================================================================

export interface UseBackgroundResult {
	/** Currently displayed background URL (resolved for browser) */
	backgroundUrl: string | null;
	/** Whether the background is visible (after initial fade-in) */
	isBackgroundVisible: boolean;
	/** CSS custom properties for background URL */
	backgroundStyle: Record<string, string> & React.CSSProperties;
}

// ============================================================================
// Constants
// ============================================================================

const THEMES_NEEDING_CACHE: string[] = [
	BackgroundTheme.SEASONS_AND_HOLIDAYS,
	BackgroundTheme.WINTER,
	BackgroundTheme.SPRING,
	BackgroundTheme.SUMMER,
	BackgroundTheme.FALL,
	BackgroundTheme.MOUNTAIN,
	BackgroundTheme.LAKES,
	BackgroundTheme.FOREST,
	BackgroundTheme.ANIMALS,
];

// ============================================================================
// Utility Functions
// ============================================================================

const resolveUrl = (url: string, plugin: BeautitabPlugin): string => {
	if (!url) return "";
	if (url.startsWith("http") || url.startsWith("data:")) return url;
	if (url.startsWith("app://")) return url;
	return plugin.app.vault.adapter.getResourcePath(url);
};

const preloadImage = (url: string): Promise<void> => {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve();
		img.onerror = () => resolve();
		img.src = url;
	});
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Main hook for managing background display.
 *
 * This hook uses LocalImageCache to get cached wallpapers that were
 * prefetched by main.ts. It handles:
 * - Loading cached wallpapers for the current hour
 * - Handling different background themes (custom, local, transparent, etc.)
 * - Fade-in animation on first load
 */
export const useBackground = (
	settings: BeautitabPluginSettings,
	plugin: BeautitabPlugin
): UseBackgroundResult => {
	const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
	const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);
	const hasShownRef = useRef(false);
	const mountTimeRef = useRef(new Date());

	// Get background on mount
	const loadBackground = useCallback(async () => {
		const { backgroundTheme, customBackground, localBackgrounds } = settings;

		logger.debug("useBackground: loading", {
			theme: backgroundTheme,
			time: mountTimeRef.current.toISOString(),
		});

		// Handle special themes
		if (
			backgroundTheme === BackgroundTheme.TRANSPARENT ||
			backgroundTheme === BackgroundTheme.TRANSPARENT_WITH_SHADOWS
		) {
			// No background for transparent themes
			setBackgroundUrl(null);
			return;
		}

		if (backgroundTheme === BackgroundTheme.CUSTOM) {
			const url = customBackground?.trim();
			if (url) {
				await preloadImage(url);
				setBackgroundUrl(url);
			}
			return;
		}

		if (backgroundTheme === BackgroundTheme.LOCAL) {
			if (localBackgrounds?.length) {
				const randomIndex = Math.floor(Math.random() * localBackgrounds.length);
				const url = localBackgrounds[randomIndex];
				const resolved = resolveUrl(url, plugin);
				await preloadImage(resolved);
				setBackgroundUrl(resolved);
			}
			return;
		}

		// Cache-based themes - get from LocalImageCache
		if (THEMES_NEEDING_CACHE.includes(backgroundTheme)) {
			try {
				const cachedPath = await plugin.imageCache.getForHour(
					backgroundTheme,
					mountTimeRef.current
				);

				if (cachedPath) {
					const resolved = plugin.imageCache.getResourcePath(cachedPath);
					logger.debug("useBackground: found cached", { cachedPath, resolved });
					await preloadImage(resolved);
					setBackgroundUrl(resolved);
				} else {
					logger.debug("useBackground: no cache found, triggering prefetch");
					// Trigger prefetch if not found
					await plugin.prefetchWallpapers();
					// Try again
					const retryPath = await plugin.imageCache.getForHour(
						backgroundTheme,
						mountTimeRef.current
					);
					if (retryPath) {
						const resolved = plugin.imageCache.getResourcePath(retryPath);
						await preloadImage(resolved);
						setBackgroundUrl(resolved);
					}
				}
			} catch (e) {
				logger.error("useBackground: cache error", e);
			}
		}
	}, [settings, plugin]);

	// Load background on mount
	useEffect(() => {
		void loadBackground();
	}, [loadBackground]);

	// Handle fade-in animation
	useEffect(() => {
		if (!backgroundUrl) return;

		if (!hasShownRef.current) {
			hasShownRef.current = true;
			requestAnimationFrame(() => setIsBackgroundVisible(true));
		} else {
			setIsBackgroundVisible(true);
		}
	}, [backgroundUrl]);

	// Generate CSS custom properties
	const backgroundStyle = useMemo<Record<string, string> & React.CSSProperties>(() => {
		const style: Record<string, string> & React.CSSProperties = {};
		if (backgroundUrl) {
			style["--beautitab-bg-url-current"] = `url("${backgroundUrl}")`;
		}
		return style;
	}, [backgroundUrl]);

	return {
		backgroundUrl,
		isBackgroundVisible,
		backgroundStyle,
	};
};
