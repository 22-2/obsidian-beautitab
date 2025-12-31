import BeautitabPlugin from "main";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { BackgroundTheme } from "src/Types/Enums";
import { CachedBackground, CachedBackgroundItem } from "src/Types/Interfaces";
import { LocalImageCache } from "src/Utils/LocalImageCache";
import logger from "src/Utils/logger";

// ========== URL Utilities ==========

/**
 * Resolve a URL to a resource path that can be used in the browser
 */
export const resolveUrl = (url: string, plugin: BeautitabPlugin): string => {
	if (!url) return "";
	if (url.startsWith("http") || url.startsWith("data:")) return url;
	if (url.startsWith("app://")) return url;
	return plugin.app.vault.adapter.getResourcePath(url);
};

/**
 * Preload an image and return a promise that resolves when loaded
 */
export const preloadImage = (url: string): Promise<void> => {
	return new Promise((resolve) => {
		let settled = false;
		const finalize = () => {
			if (settled) return;
			settled = true;
			resolve();
		};

		const img = new Image();
		img.onload = finalize;
		img.onerror = finalize;
		img.src = url;
		img.decode?.().then(finalize).catch(finalize);
	});
};

// ========== Date Utilities ==========

/**
 * Check if two dates are the same day
 */
export const isSameDate = (date1: Date, date2: Date): boolean => {
	return (
		date1.getDate() === date2.getDate() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getFullYear() === date2.getFullYear()
	);
};

/**
 * Check if two dates are in the same hour
 */
export const isSameHour = (date1: Date, date2: Date): boolean => {
	return (
		isSameDate(date1, date2) &&
		date1.getHours() === date2.getHours()
	);
};

/**
 * Check if a background was created in the target hour
 */
export const isBackgroundFromTargetHour = (
	bg: CachedBackground,
	target: Date
): boolean => {
	if (!bg.date) return false;
	const bgDate = new Date(bg.date);
	return isSameHour(bgDate, target);
};

// ========== File Utilities ==========

/**
 * Check if a cached file exists (for local files)
 */
export const checkFileExists = async (
	url: string,
	plugin: BeautitabPlugin
): Promise<boolean> => {
	if (!url || url.startsWith("http") || url.startsWith("data:")) return true;
	const cache = new LocalImageCache(plugin);
	return await cache.exists(url);
};

// ========== Theme Utilities ==========

/**
 * Check if theme is transparent (no background image needed)
 */
export const isTransparentTheme = (theme: BackgroundTheme): boolean => {
	return (
		theme === BackgroundTheme.TRANSPARENT ||
		theme === BackgroundTheme.TRANSPARENT_WITH_SHADOWS
	);
};

/**
 * Check if theme is time-based (changes every hour)
 */
export const isTimeBasedTheme = (theme: BackgroundTheme): boolean => {
	return (
		!isTransparentTheme(theme) &&
		theme !== BackgroundTheme.CUSTOM &&
		theme !== BackgroundTheme.LOCAL
	);
};

/**
 * Generate a cache key for a given theme and settings
 */
export const buildCacheKey = (settings: BeautitabPluginSettings): string => {
	if (
		settings.backgroundTheme === BackgroundTheme.CUSTOM &&
		settings.customBackground
	) {
		return `custom:${settings.customBackground}`;
	}
	return `unsplash:${settings.backgroundTheme}`;
};

// ========== Validation ==========

/**
 * Normalize a URL by removing query parameters (for comparison)
 */
const normalizeUrlForComparison = (url: string): string => {
	try {
		const u = new URL(url);
		return `${u.origin}${u.pathname}`;
	} catch {
		return url;
	}
};

/**
 * Validate if a cached background is usable for the current settings and time
 */
export const validateCachedBackground = (
	cached: CachedBackground | undefined | null,
	settings: BeautitabPluginSettings,
	targetDate: Date = new Date()
): boolean => {
	if (!cached?.url) {
		logger.debug("Beautitab: Validation failed - no cached URL");
		return false;
	}

	if (isTransparentTheme(settings.backgroundTheme)) {
		logger.debug("Beautitab: Validation failed - transparent theme");
		return false;
	}

	if (cached.theme !== settings.backgroundTheme) {
		logger.debug("Beautitab: Validation failed - theme mismatch", {
			cached: cached.theme,
			current: settings.backgroundTheme,
		});
		return false;
	}

	// Custom background - compare URLs
	if (settings.backgroundTheme === BackgroundTheme.CUSTOM) {
		const trimmed = settings.customBackground?.trim();
		const isValid =
			!!trimmed &&
			normalizeUrlForComparison(trimmed) ===
				normalizeUrlForComparison(cached.url);
		logger.debug("Beautitab: Custom background validation", { isValid });
		return isValid;
	}

	// Local background - check if URL is in the list
	if (settings.backgroundTheme === BackgroundTheme.LOCAL) {
		const isValid = settings.localBackgrounds?.includes(cached.url) ?? false;
		logger.debug("Beautitab: Local background validation", { isValid });
		return isValid;
	}

	// Time-based themes - must be from the correct hour
	const isFromTargetHour = isBackgroundFromTargetHour(cached, targetDate);
	logger.debug("Beautitab: Hour-based validation", {
		isFromTargetHour,
		cachedHour: cached.date ? new Date(cached.date).getHours() : null,
		targetHour: targetDate.getHours(),
	});

	return isFromTargetHour;
};

// ========== Cache Lookup ==========

/**
 * Find a fresh background in the cache map for the given time
 */
export const findFreshBackgroundInCache = (
	settings: BeautitabPluginSettings,
	targetTime: Date
): CachedBackground | null => {
	const cacheKey = buildCacheKey(settings);
	const cache = settings.backgroundCache ?? {};
	const entry = cache[cacheKey];

	if (!entry?.items?.length) return null;

	const freshItem = entry.items.find((item: CachedBackgroundItem) => {
		const itemDate = new Date(item.date);
		return isSameHour(itemDate, targetTime);
	});

	if (freshItem) {
		logger.debug("Beautitab: Found fresh background in cache map", freshItem);
		return {
			url: freshItem.url,
			date: new Date(freshItem.date),
			theme: freshItem.theme,
		};
	}

	return null;
};

/**
 * Get the initial background to display
 * Priority: valid cached background > fresh from cache map > null
 */
export const getInitialBackground = (
	settings: BeautitabPluginSettings,
	effectiveTime: Date
): CachedBackground | null => {
	// 1. Check if the currently cached background is valid
	if (
		settings.cachedBackground &&
		validateCachedBackground(settings.cachedBackground, settings, effectiveTime)
	) {
		return settings.cachedBackground;
	}

	// 2. Try to find a valid background in the cache map (prefetched)
	const freshFromCache = findFreshBackgroundInCache(settings, effectiveTime);
	if (freshFromCache) {
		return freshFromCache;
	}

	logger.debug("Beautitab: No valid cached background found for init");
	return null;
};
