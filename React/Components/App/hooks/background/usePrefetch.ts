import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import BeautitabPlugin from "main";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { CachedBackground } from "src/Types/Interfaces";
import { LocalImageCache } from "src/Utils/LocalImageCache";
import { buildBackgroundQueryKey } from "src/Utils/backgroundQuery";
import getBackground from "React/Utils/getBackground";
import logger from "src/Utils/logger";
import { PREFETCH_STALE_TIME } from "./constants";
import { isTimeBasedTheme } from "./utils";

interface UsePrefetchOptions {
	settings: BeautitabPluginSettings;
	plugin: BeautitabPlugin;
	currentBg: CachedBackground | null;
}

/**
 * Hook to prefetch next hour's background
 */
export const usePrefetch = ({
	settings,
	plugin,
	currentBg,
}: UsePrefetchOptions): void => {
	const queryClient = useQueryClient();

	useEffect(() => {
		// Only prefetch for time-based themes
		if (!isTimeBasedTheme(settings.backgroundTheme)) {
			return;
		}

		// Only prefetch if we have a current background
		if (!currentBg) return;

		const now = new Date();
		const nextHour = new Date(now);
		nextHour.setHours(now.getHours() + 1, 0, 0, 0);

		logger.debug("Beautitab: Prefetching background for next hour", {
			currentHour: now.getHours(),
			nextHour: nextHour.getHours(),
			theme: settings.backgroundTheme,
		});

		void queryClient.prefetchQuery({
			queryKey: buildBackgroundQueryKey(settings, nextHour),
			queryFn: async () => {
				logger.debug("Beautitab: Prefetch executing", {
					nextHour: nextHour.toISOString(),
				});

				try {
					const result = await getBackground(
						settings.backgroundTheme,
						settings.customBackground,
						settings.localBackgrounds,
						settings.apiKey,
						plugin.settings.backgroundCache ?? settings.backgroundCache,
						false, // Don't force refresh for prefetch
						nextHour
					);

					logger.debug("Beautitab: Prefetch result", {
						background: result.background,
					});

					if (result.backgroundCache) {
						plugin.settings.backgroundCache = result.backgroundCache;
						await plugin.saveSettings();
					}

					// Cache remote images locally
					if (result.background?.url?.startsWith("http")) {
						logger.debug(
							"Beautitab: Prefetch - caching locally",
							result.background.url
						);
						const cache = new LocalImageCache(plugin);
						const localPath = await cache.saveImage(result.background.url, {
							theme: result.background.theme,
							date: result.background.date,
						});
						if (localPath) {
							result.background.url = localPath;
						}
					}

					return result.background;
				} catch (error) {
					logger.error("Beautitab: Error in prefetch", error);
					return null;
				}
			},
			staleTime: PREFETCH_STALE_TIME,
		});
	}, [currentBg, queryClient, settings, plugin]);
};
