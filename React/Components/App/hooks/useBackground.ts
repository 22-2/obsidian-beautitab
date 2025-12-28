import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { BackgroundTheme } from "src/Types/Enums";
import { CachedBackground } from "src/Types/Interfaces";
import BeautitabPlugin from "main";
import { LocalImageCache } from "src/Utils/LocalImageCache";
import { fetchNewBackground } from "src/Utils/backgroundFetcher";
import { buildBackgroundQueryKey } from "src/Utils/backgroundQuery";
import getBackground from "React/Utils/getBackground";
import logger from "src/Utils/logger";

// ========== Constants ==========

const CROSSFADE_DURATION = 500;
const STALE_TIME = 1000 * 60 * 60; // 1 hour
const GC_TIME = 1000 * 60 * 60 * 24; // 24 hours
const PREFETCH_STALE_TIME = 1000 * 60 * 5; // 5 minutes

// ========== Types ==========

interface UseBackgroundResult {
	currentBg: CachedBackground | null;
	incomingBg: CachedBackground | null;
	isBackgroundVisible: boolean;
	isCrossfading: boolean;
	backgroundStyle: Record<string, string> & React.CSSProperties;
}

// ========== Utility Functions ==========

const resolveUrl = (url: string, plugin: BeautitabPlugin): string => {
	if (!url) return "";
	if (url.startsWith("http") || url.startsWith("data:")) return url;
	// If it's already an app:// URL, return it as is
	if (url.startsWith("app://")) return url;
	return plugin.app.vault.adapter.getResourcePath(url);
};

const preloadImage = (url: string): Promise<void> => {
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

const isSameDate = (date1: Date, date2: Date): boolean => {
	return (
		date1.getDate() === date2.getDate() &&
		date1.getMonth() === date2.getMonth() &&
		date1.getFullYear() === date2.getFullYear()
	);
};

// ========== Validation Functions ==========

const checkFileExists = async (url: string, plugin: BeautitabPlugin): Promise<boolean> => {
	if (!url || url.startsWith("http") || url.startsWith("data:")) return true;
	const cache = new LocalImageCache(plugin);
	return await cache.exists(url);
};

const isTransparentTheme = (theme: BackgroundTheme): boolean => {
	return (
		theme === BackgroundTheme.TRANSPARENT ||
		theme === BackgroundTheme.TRANSPARENT_WITH_SHADOWS
	);
};

const isBackgroundFromTargetHour = (
	bg: CachedBackground,
	target: Date
): boolean => {
	if (!bg.date) return false;
	const bgDate = new Date(bg.date);
	return isSameDate(bgDate, target) && bgDate.getHours() === target.getHours();
};

const validateCachedBackground = (
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

	// Custom background validation - no time check needed
	if (settings.backgroundTheme === BackgroundTheme.CUSTOM) {
		const trimmed = settings.customBackground?.trim();
		// Compare URLs without query parameters for validation
		const normalizeUrl = (url: string) => {
			try {
				const u = new URL(url);
				return `${u.origin}${u.pathname}`;
			} catch {
				return url;
			}
		};
		const isValid = !!trimmed && normalizeUrl(trimmed) === normalizeUrl(cached.url);
		logger.debug("Beautitab: Custom background validation", {
			isValid,
			trimmed,
			cachedUrl: cached.url,
			normalizedTrimmed: trimmed ? normalizeUrl(trimmed) : null,
			normalizedCached: normalizeUrl(cached.url),
		});
		return isValid;
	}

	// Local background validation - no time check needed
	if (settings.backgroundTheme === BackgroundTheme.LOCAL) {
		const isValid = settings.localBackgrounds?.includes(cached.url) ?? false;
		logger.debug("Beautitab: Local background validation", { isValid });
		return isValid;
	}

	// Date-based themes (Unsplash) require today's background at the correct hour
	const isFromTargetHour = isBackgroundFromTargetHour(cached, targetDate);
	logger.debug("Beautitab: Hour-based validation", {
		isFromTargetHour,
		cachedDate: cached.date,
		cachedHour: cached.date ? new Date(cached.date).getHours() : null,
		targetHour: targetDate.getHours(),
	});

	return isFromTargetHour;
};

// ========== Custom Hook ==========

export const useBackground = (
	settings: BeautitabPluginSettings,
	plugin: BeautitabPlugin
): UseBackgroundResult => {
	const queryClient = useQueryClient();

	const mountTime = useMemo(() => new Date(), []);
	const [currentTime, setCurrentTime] = useState(() => new Date());

	const effectiveTime = settings.refreshBackgroundOnHourChange
		? currentTime
		: mountTime;
	const currentHour = effectiveTime.getHours();
	const currentDay = effectiveTime.toDateString();

	// Poll for hour changes when refreshBackgroundOnHourChange is enabled
	useEffect(() => {
		if (!settings.refreshBackgroundOnHourChange) return;

		const checkInterval = setInterval(() => {
			const now = new Date();
			if (now.getHours() !== currentTime.getHours()) {
				logger.info("Beautitab: Hour changed, updating background", {
					from: currentTime.getHours(),
					to: now.getHours(),
				});
				setCurrentTime(now);
			}
		}, 30000); // Check every 30 seconds

		return () => clearInterval(checkInterval);
	}, [settings.refreshBackgroundOnHourChange, currentTime]);

	// Determine if cached background is usable
	const isCachedUsable = useMemo(() => {
		// Always refetch if debug mode is on
		if (settings.debugRefreshBackgroundOnOpen) {
			logger.debug("Beautitab: Debug mode - forcing refresh");
			return false;
		}

		// No cached background available
		if (!settings.cachedBackground?.url) {
			logger.debug("Beautitab: No cached background available");
			return false;
		}

		// Validate the cached background
		const isValid = validateCachedBackground(
			settings.cachedBackground,
			settings,
			effectiveTime
		);

		logger.debug("Beautitab: Cache validation", {
			isValid,
			cachedTheme: settings.cachedBackground.theme,
			currentTheme: settings.backgroundTheme,
			cachedDate: settings.cachedBackground.date,
			effectiveTime: effectiveTime.toISOString(),
			currentHour,
			currentDay,
		});

		return isValid;
	}, [
		settings.debugRefreshBackgroundOnOpen,
		settings.cachedBackground,
		settings.backgroundTheme,
		settings.customBackground,
		settings.localBackgrounds,
		currentHour,
		currentDay,
		effectiveTime,
	]);

	// Fetch new background if needed
	const { data: fetchedBg, isSuccess, refetch, isLoading, isError, error } = useQuery({
		queryKey: buildBackgroundQueryKey(settings, effectiveTime),
		queryFn: async () => {
			logger.debug("Beautitab: useQuery queryFn executing", {
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

				logger.debug("Beautitab: getBackground result in useQuery", { background: result.background });

				if (result.backgroundCache) {
					plugin.settings.backgroundCache = result.backgroundCache;
					await plugin.saveSettings();
				}

				if (result.background && result.background.url && result.background.url.startsWith("http")) {
					logger.info("Beautitab: Attempting to cache locally", result.background.url);
					const cache = new LocalImageCache(plugin);
					const localPath = await cache.saveImage(result.background.url, {
						theme: result.background.theme,
						date: result.background.date,
					});
					logger.debug("Beautitab: cache.saveImage result", localPath);
					if (localPath) {
						result.background.url = localPath;
						if (Math.random() < 0.1) {
							void cache.pruneCache();
						}
					}
				}

				logger.debug("Beautitab: useQuery queryFn complete", result.background);
				return result.background;
			} catch (error) {
				logger.error("Beautitab: Error in useQuery queryFn", error);
				return null;
			}
		},
		staleTime: STALE_TIME,
		gcTime: GC_TIME,
		enabled: !isCachedUsable,
		refetchOnMount: true,
		refetchOnWindowFocus: false,
	});

	// Log query state
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

	// State management
	const [currentBg, setCurrentBg] = useState<CachedBackground | null>(
		settings.cachedBackground ?? null
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

	// Verify file existence for initial/cached background
	useEffect(() => {
		const verify = async () => {
			if (currentBg?.url) {
				const exists = await checkFileExists(currentBg.url, plugin);
				if (!exists) {
					logger.warn("Beautitab: Cached background file missing, refetching...");
					setCurrentBg(null);
					// Clear the cached background from settings
					plugin.settings.cachedBackground = null;
					await plugin.saveSettings();
					void refetch();
				}
			}
		};
		void verify();
	}, [plugin, refetch, currentBg?.url]);

	// Prefetch next background
	useEffect(() => {
		if (!isSuccess || !fetchedBg) return;

		const now = new Date();
		const nextHour = new Date(now);
		nextHour.setHours(now.getHours() + 1);
		nextHour.setMinutes(0, 0, 0);

		queryClient.prefetchQuery({
			queryKey: buildBackgroundQueryKey(settings, nextHour),
			queryFn: () =>
				fetchNewBackground({
					settings,
					plugin,
					now: nextHour,
				}),
			staleTime: PREFETCH_STALE_TIME,
		});
	}, [isSuccess, fetchedBg, queryClient, settings, plugin]);

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
				logger.warn("Beautitab: Background file missing during update, refetching...");
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
	}, [isCachedUsable, settings.cachedBackground, fetchedBg, plugin]);

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
	}, [
		currentBg,
		settings.cachedBackground,
		settings.debugRefreshBackgroundOnOpen,
		plugin,
	]);

	// Generate CSS custom properties
	const backgroundStyle = useMemo<
		Record<string, string> & React.CSSProperties
	>(() => {
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

	return {
		currentBg,
		incomingBg,
		isBackgroundVisible,
		isCrossfading,
		backgroundStyle,
	};
};
