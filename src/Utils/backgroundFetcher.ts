import { BackgroundTheme } from "src/Types/Enums";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { CachedBackground } from "src/Types/Interfaces";
import getBackground from "React/Utils/getBackground";
import BeautitabPlugin from "main";
import { LocalImageCache } from "src/Utils/LocalImageCache";

export interface FetchBackgroundParams {
	settings: BeautitabPluginSettings;
	forceRefresh?: boolean;
	plugin: BeautitabPlugin;
	now?: Date;
}

/**
 * Fetches a new background image based on settings and caches it locally.
 * Also updates the background cache in the plugin settings.
 */
export const fetchNewBackground = async ({
	settings,
	forceRefresh = false,
	plugin,
	now = new Date(),
}: FetchBackgroundParams): Promise<CachedBackground | null> => {
	const result = await getBackground(
		settings.backgroundTheme,
		settings.customBackground,
		settings.localBackgrounds,
		settings.apiKey,
		settings.backgroundCache,
		settings.debugRefreshBackgroundOnOpen || forceRefresh,
		now
	);

	// Update the cache in settings if it changed
	if (result.backgroundCache) {
		plugin.settings.backgroundCache = result.backgroundCache;
		await plugin.saveSettings();
	}

	// Cache remote images locally
	if (result.background?.url && !result.background.url.startsWith("data:")) {
		const cache = new LocalImageCache(plugin);
		const localPath = await cache.saveImage(result.background.url);
		if (localPath) {
			result.background.url = localPath;
			// Prune cache occasionally (e.g. 10% chance)
			if (Math.random() < 0.1) {
				void cache.pruneCache();
			}
		}
	}

	return result.background;
};
