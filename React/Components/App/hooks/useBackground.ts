import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { BackgroundTheme } from "src/Types/Enums";
import { CachedBackground } from "src/Types/Interfaces";
import BeautitabPlugin from "main";
import { LocalImageCache } from "src/Utils/LocalImageCache";
import { fetchNewBackground } from "src/Utils/backgroundFetcher";

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
	if (!cached?.url || isTransparentTheme(settings.backgroundTheme)) {
		return false;
	}

	if (cached.theme !== settings.backgroundTheme) return false;

	// Custom background validation
	if (settings.backgroundTheme === BackgroundTheme.CUSTOM) {
		const trimmed = settings.customBackground?.trim();
		return !!trimmed && trimmed === cached.url;
	}

	// Date-based themes require today's background
	if (!isBackgroundFromTargetHour(cached, targetDate)) return false;

	// Local background validation
	if (settings.backgroundTheme === BackgroundTheme.LOCAL) {
		return settings.localBackgrounds?.includes(cached.url) ?? false;
	}

	return true;
};

// ========== Custom Hook ==========

export const useBackground = (
	settings: BeautitabPluginSettings,
	plugin: BeautitabPlugin
): UseBackgroundResult => {
	const queryClient = useQueryClient();

	const mountTime = useMemo(() => new Date(), []);
	const now = new Date();

	const effectiveTime = settings.refreshBackgroundOnHourChange
		? now
		: mountTime;
	const currentHour = effectiveTime.getHours();
	const currentDay = effectiveTime.toDateString();

	// Determine if cached background is usable
	const isCachedUsable = useMemo(
		() =>
			!settings.debugRefreshBackgroundOnOpen &&
			validateCachedBackground(
				settings.cachedBackground,
				settings,
				effectiveTime
			),
		[
			settings.debugRefreshBackgroundOnOpen,
			settings.cachedBackground,
			settings.backgroundTheme,
			settings.customBackground,
			settings.localBackgrounds,
			currentHour,
			currentDay,
		]
	);

	// Fetch new background if needed
	const { data: fetchedBg, isSuccess, refetch } = useQuery({
		queryKey: [
			"background",
			settings.backgroundTheme,
			settings.customBackground,
			settings.localBackgrounds,
			currentDay,
			currentHour,
		],
		queryFn: () =>
			fetchNewBackground({
				settings,
				plugin,
				forceRefresh: settings.debugRefreshBackgroundOnOpen,
				now: effectiveTime,
			}),
		staleTime: STALE_TIME,
		gcTime: GC_TIME,
		enabled: !isCachedUsable,
	});

	// State management
	const [currentBg, setCurrentBg] = useState<CachedBackground | null>(
		isCachedUsable ? settings.cachedBackground ?? null : null
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
					console.warn("Beautitab: Cached background file missing, refetching...");
					setCurrentBg(null);
					void refetch();
				}
			}
		};
		void verify();
	}, [plugin, refetch]);

	// Prefetch next background
	useEffect(() => {
		if (!isSuccess || !fetchedBg) return;

		queryClient.prefetchQuery({
			queryKey: ["background", settings.backgroundTheme, "next"],
			queryFn: () =>
				fetchNewBackground({ settings, plugin, forceRefresh: true }),
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
				console.warn("Beautitab: Background file missing during update, refetching...");
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
