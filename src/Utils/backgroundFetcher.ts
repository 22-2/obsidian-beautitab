import { BeautitabPluginSettings } from "src/Settings/Settings";
import { CachedBackground } from "src/Types/Interfaces";
import getBackground from "React/Utils/getBackground";
import BeautitabPlugin from "main";
import { LocalImageCache } from "src/Utils/LocalImageCache";
import { buildBackgroundQueryKey } from "src/Utils/backgroundQuery";
import { setSettings } from "src/Utils/settingsStore";
import logger from "./logger";

const CACHE_PRUNE_PROBABILITY = 0.1;
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export interface FetchBackgroundParams {
	settings: BeautitabPluginSettings;
	forceRefresh?: boolean;
	plugin: BeautitabPlugin;
	now?: Date;
}

const shouldForceRefresh = (
	settings: BeautitabPluginSettings,
	forceRefresh: boolean
): boolean => settings.debugRefreshBackgroundOnOpen || forceRefresh;

const shouldCacheLocally = (background: CachedBackground): boolean => {
	if (!background.url) return false;
	if (background.url.startsWith("data:")) return false;
	// Don't cache local file paths
	if (!background.url.startsWith("http")) return false;
	return true;
};

const maybePruneCache = (cache: LocalImageCache): void => {
	if (Math.random() < CACHE_PRUNE_PROBABILITY) {
		void cache.pruneCache();
	}
};

// Core fetch function
const fetchBackgroundCore = async (
	settings: BeautitabPluginSettings,
	forceRefresh: boolean,
	plugin: BeautitabPlugin,
	now: Date
): Promise<CachedBackground | null> => {
	try {
		logger.debug("Beautitab: fetchBackgroundCore start", { theme: settings.backgroundTheme, forceRefresh });
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

		if (result.backgroundCache) {
			plugin.settings.backgroundCache = result.backgroundCache;
			await plugin.saveSettings();
			setSettings(plugin.settings);
		}

		if (result.background && shouldCacheLocally(result.background)) {
			logger.info("Beautitab: Attempting to cache locally", result.background.url);
			const cache = new LocalImageCache(plugin);
			const localPath = await cache.saveImage(result.background.url, {
				theme: result.background.theme,
				date: result.background.date,
			});
			logger.debug("Beautitab: cache.saveImage result", localPath);
			if (localPath) {
				result.background.url = localPath;
				maybePruneCache(cache);
			}
		} else {
			logger.debug("Beautitab: Skipping local cache", { bgInfo: result.background,
				reason: !result.background ? "no background" : "shouldCacheLocally=false" });
		}

		logger.debug("Beautitab: fetchBackgroundCore complete", result.background);
		return result.background;
	} catch (error) {
		logger.error("Beautitab: Error in fetchBackgroundCore", error);
		return null;
	}
};

/**
 * Fetches a new background image based on settings and caches it locally.
 * Uses QueryClient for in-flight deduplication and caching.
 */
export const fetchNewBackground = async ({
	settings,
	forceRefresh = false,
	plugin,
	now = new Date(),
}: FetchBackgroundParams): Promise<CachedBackground | null> => {
	try {
		logger.debug("Beautitab: fetchNewBackground called", { theme: settings.backgroundTheme, forceRefresh });
		const queryKey = buildBackgroundQueryKey(settings, now);
		const bypass = shouldForceRefresh(settings, forceRefresh);

		const result = await plugin.queryClient.fetchQuery({
			queryKey,
			queryFn: () => fetchBackgroundCore(settings, bypass, plugin, now),
			staleTime: bypass ? 0 : STALE_TIME,
		});

		logger.debug("Beautitab: fetchNewBackground complete", result);
		return result;
	} catch (error) {
		logger.error("Beautitab: Error in fetchNewBackground", error);
		return null;
	}
};
