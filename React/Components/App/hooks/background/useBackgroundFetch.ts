import { useQuery } from "@tanstack/react-query";
import BeautitabPlugin from "main";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { CachedBackground } from "src/Types/Interfaces";
import { LocalImageCache } from "src/Utils/LocalImageCache";
import { buildBackgroundQueryKey } from "src/Utils/backgroundQuery";
import getBackground from "React/Utils/getBackground";
import logger from "src/Utils/logger";
import { STALE_TIME, GC_TIME } from "./constants";

interface UseBackgroundFetchOptions {
	settings: BeautitabPluginSettings;
	plugin: BeautitabPlugin;
	effectiveTime: Date;
	enabled: boolean;
}

interface UseBackgroundFetchResult {
	fetchedBg: CachedBackground | null | undefined;
	isSuccess: boolean;
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	refetch: () => void;
}

/**
 * Hook to fetch new background when needed
 */
export const useBackgroundFetch = ({
	settings,
	plugin,
	effectiveTime,
	enabled,
}: UseBackgroundFetchOptions): UseBackgroundFetchResult => {
	const {
		data: fetchedBg,
		isSuccess,
		refetch,
		isLoading,
		isError,
		error,
	} = useQuery({
		queryKey: buildBackgroundQueryKey(settings, effectiveTime),
		queryFn: async () => {
			logger.debug("Beautitab: Fetching new background", {
				theme: settings.backgroundTheme,
				customBg: settings.customBackground,
				effectiveTime: effectiveTime.toISOString(),
			});

			try {
				const result = await getBackground(
					settings.backgroundTheme,
					settings.customBackground,
					settings.localBackgrounds,
					settings.apiKey,
					plugin.settings.backgroundCache ?? settings.backgroundCache,
					settings.debugRefreshBackgroundOnOpen,
					effectiveTime
				);

				logger.debug("Beautitab: getBackground result", {
					background: result.background,
				});

				// Save updated cache
				if (result.backgroundCache) {
					plugin.settings.backgroundCache = result.backgroundCache;
					await plugin.saveSettings();
				}

				// Cache remote images locally
				if (result.background?.url?.startsWith("http")) {
					logger.info(
						"Beautitab: Caching image locally",
						result.background.url
					);
					const cache = new LocalImageCache(plugin);
					const localPath = await cache.saveImage(result.background.url, {
						theme: result.background.theme,
						date: result.background.date,
					});
					if (localPath) {
						result.background.url = localPath;
						// Occasionally prune old cache
						if (Math.random() < 0.1) {
							void cache.pruneCache();
						}
					}
				}

				return result.background;
			} catch (err) {
				logger.error("Beautitab: Error fetching background", err);
				return null;
			}
		},
		staleTime: STALE_TIME,
		gcTime: GC_TIME,
		enabled,
		refetchOnMount: true,
		refetchOnWindowFocus: false,
	});

	return {
		fetchedBg,
		isSuccess,
		isLoading,
		isError,
		error: error as Error | null,
		refetch,
	};
};
