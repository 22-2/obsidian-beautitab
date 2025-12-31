import { BeautitabPluginSettings } from "src/Settings/Settings";
import { BackgroundCache, CachedBackground } from "src/Types/Interfaces";
import getBackground from "React/Utils/getBackground";
import BeautitabPlugin from "main";
import { LocalImageCache } from "src/Utils/LocalImageCache";
import { buildBackgroundQueryKey } from "src/Utils/backgroundQuery";
import { setSettings } from "src/Utils/settingsStore";
import logger from "./logger";

// =============================================================================
// Constants
// =============================================================================

/** Probability of triggering cache pruning on each fetch (10%) */
const CACHE_PRUNE_PROBABILITY = 0.1;

/** Time in ms before a cached query result is considered stale */
const STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Types
// =============================================================================

export interface FetchBackgroundParams {
	settings: BeautitabPluginSettings;
	forceRefresh?: boolean;
	plugin: BeautitabPlugin;
	now?: Date;
}

interface LocalCacheResult {
	resourcePath: string;
	background: CachedBackground;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determines if the background fetch should bypass cache.
 */
const shouldForceRefresh = (
	settings: BeautitabPluginSettings,
	forceRefresh: boolean
): boolean => settings.debugRefreshBackgroundOnOpen || forceRefresh;

/**
 * Determines if the background should be cached locally.
 * We skip caching for:
 * - Empty URLs
 * - Data URLs (already embedded)
 * - Local file paths (not HTTP)
 */
const shouldCacheLocally = (background: CachedBackground): boolean => {
	if (!background.url) return false;
	if (background.url.startsWith("data:")) return false;
	if (!background.url.startsWith("http")) return false;
	return true;
};

/**
 * Triggers cache pruning with a random probability.
 */
const maybePruneCache = (cache: LocalImageCache): void => {
	if (Math.random() < CACHE_PRUNE_PROBABILITY) {
		void cache.pruneCache();
	}
};

/**
 * Updates all matching cache entries with the new local resource path.
 * Matches entries by date and theme to ensure correctness.
 */
const updateCacheEntriesWithLocalPath = (
	cache: BackgroundCache,
	background: CachedBackground,
	resourcePath: string
): void => {
	for (const key of Object.keys(cache)) {
		const entry = cache[key];
		if (!entry?.items) continue;

		entry.items.forEach(item => {
			const isSameDate = new Date(item.date).getTime() === background.date.getTime();
			const isSameTheme = item.theme === background.theme;

			if (isSameDate && isSameTheme) {
				item.url = resourcePath;
			}
		});
	}
};

/**
 * Attempts to save the background image to local cache and returns the resource path.
 */
const cacheBackgroundLocally = async (
	background: CachedBackground,
	plugin: BeautitabPlugin
): Promise<LocalCacheResult | null> => {
	const cache = new LocalImageCache(plugin);

	try {
		const localPath = await cache.saveImage(background.url, {
			theme: background.theme,
			date: background.date,
		});

		if (!localPath) {
			logger.debug("Beautitab: Failed to save image to local cache");
			return null;
		}

		const resourcePath = await cache.getResourcePath(localPath);
		maybePruneCache(cache);

		return { resourcePath, background };
	} catch (error) {
		logger.error("Beautitab: Error caching background locally", error);
		return null;
	}
};

/**
 * Persists the background cache to plugin settings.
 */
const persistBackgroundCache = async (
	plugin: BeautitabPlugin,
	cache: BackgroundCache
): Promise<void> => {
	plugin.settings.backgroundCache = cache;
	await plugin.saveSettings();
	setSettings(plugin.settings);
};

// =============================================================================
// Core Fetch Logic
// =============================================================================

/**
 * Core function that fetches a background and handles local caching.
 * Separated from the public API to allow QueryClient wrapping.
 */
const fetchBackgroundCore = async (
	settings: BeautitabPluginSettings,
	forceRefresh: boolean,
	plugin: BeautitabPlugin,
	now: Date
): Promise<CachedBackground | null> => {
	try {
		logger.debug("Beautitab: fetchBackgroundCore start", {
			theme: settings.backgroundTheme,
			forceRefresh,
		});

		// Fetch background from remote or cache
		const result = await getBackground(
			settings.backgroundTheme,
			settings.customBackground,
			settings.localBackgrounds,
			settings.apiKey,
			plugin.settings.backgroundCache ?? settings.backgroundCache,
			shouldForceRefresh(settings, forceRefresh),
			now
		);

		logger.debug("Beautitab: getBackground result", { background: result.background });

		const background = result.background;
		let cacheToSave = result.backgroundCache || plugin.settings.backgroundCache;

		// Process local caching if applicable
		if (background && shouldCacheLocally(background)) {
			logger.info("Beautitab: Attempting to cache locally", background.url);

			const localCacheResult = await cacheBackgroundLocally(background, plugin);

			if (localCacheResult) {
				const { resourcePath } = localCacheResult;
				logger.debug("Beautitab: Local cache successful", resourcePath);

				// Update background URL to use local resource
				background.url = resourcePath;

				// Update cache entries with local path
				if (cacheToSave) {
					updateCacheEntriesWithLocalPath(cacheToSave, background, resourcePath);
				}
			}
		} else {
			logger.debug("Beautitab: Skipping local cache", {
				bgInfo: background,
				reason: !background ? "no background" : "shouldCacheLocally=false",
			});
		}

		// Persist cache if we have updates
		if (cacheToSave) {
			await persistBackgroundCache(plugin, cacheToSave);
		}

		logger.debug("Beautitab: fetchBackgroundCore complete", background);
		return background;
	} catch (error) {
		logger.error("Beautitab: Error in fetchBackgroundCore", error);
		return null;
	}
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Fetches a new background image based on settings and caches it locally.
 * Uses QueryClient for in-flight deduplication and caching.
 *
 * @param params - Fetch parameters including settings, plugin instance, and optional flags
 * @returns The cached background or null if fetch failed
 */
export const fetchNewBackground = async ({
	settings,
	forceRefresh = false,
	plugin,
	now = new Date(),
}: FetchBackgroundParams): Promise<CachedBackground | null> => {
	try {
		logger.debug("Beautitab: fetchNewBackground called", {
			theme: settings.backgroundTheme,
			forceRefresh,
		});

		const queryKey = buildBackgroundQueryKey(settings, now);
		const bypass = shouldForceRefresh(settings, forceRefresh);

		const result = await plugin.queryClient.fetchQuery({
			queryKey,
			queryFn: () => fetchBackgroundCore(settings, bypass, plugin, now),
			staleTime: bypass ? 0 : STALE_TIME_MS,
		});

		logger.debug("Beautitab: fetchNewBackground complete", result);
		return result;
	} catch (error) {
		logger.error("Beautitab: Error in fetchNewBackground", error);
		return null;
	}
};
