// ============================================================================
// Background Module - Main Entry Point
// ============================================================================

import log from "loglevel";

import {
	BackgroundCache,
	BackgroundTheme,
	CachedBackground,
	CachedBackgroundItem,
	GetBackgroundResult,
	CACHE_TTL_MINUTES,
	CACHE_MAX_ITEMS,
} from "./types";

import {
	normalizeBackgroundCache,
	selectFromCache,
	updateCache,
} from "./cache";

import { getSeasonalTag } from "./seasonalTheme";
import { fetchFromUnsplashApi, maybeLowerQualityUnsplashUrl } from "./unsplashApi";

// ============================================================================
// Re-exports
// ============================================================================

export * from "./types";
export * from "./cache";
export { isWithinDaysBefore, getEasterDate, getSeasonalTag } from "./seasonalTheme";
export { maybeLowerQualityUnsplashUrl } from "./unsplashApi";

// For backward compatibility
export { getEasterDate as default } from "./seasonalTheme";

// ============================================================================
// Logger
// ============================================================================

const logger = log.getLogger("getBackground");

// ============================================================================
// Internal Types
// ============================================================================

interface GetBackgroundContext {
	cache: BackgroundCache;
	now: Date;
	forceRefresh: boolean;
	apiKey: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const createCacheKey = (theme: BackgroundTheme, url?: string): string =>
	theme === BackgroundTheme.CUSTOM && url
		? `custom:${url}`
		: `unsplash:${theme}`;

const buildCachedBackground = (
	item: CachedBackgroundItem | null | undefined
): CachedBackground | null => {
	if (!item) return null;
	return {
		url: maybeLowerQualityUnsplashUrl(item.url),
		date: new Date(item.date),
		theme: item.theme,
	};
};

// ============================================================================
// Cache-aware Fetcher
// ============================================================================

const fetchWithCache = async (
	ctx: GetBackgroundContext,
	key: string,
	theme: BackgroundTheme,
	query: string
): Promise<GetBackgroundResult> => {
	const { cache, now, forceRefresh, apiKey } = ctx;

	// 1. Try cache first
	const cached = selectFromCache(cache, key, {
		now,
		forceRefresh,
	});
	if (cached?.background) {
		return {
			background: buildCachedBackground(cached.background),
			backgroundCache: cached.cache,
		};
	}

	// 2. No API key = no fetch
	if (!apiKey) {
		return { background: null, backgroundCache: cache };
	}

	// 3. Fetch from Unsplash
	const item = await fetchFromUnsplashApi(apiKey, query, theme, now);
	if (!item) {
		return { background: null, backgroundCache: cache };
	}

	// 4. Update cache and return
	const updatedCache = updateCache(cache, key, item, { now });

	return {
		background: buildCachedBackground(item),
		backgroundCache: updatedCache,
	};
};

// ============================================================================
// Theme Handlers
// ============================================================================

const handleSeasonsAndHolidays = (
	ctx: GetBackgroundContext
): Promise<GetBackgroundResult> => {
	const key = createCacheKey(BackgroundTheme.SEASONS_AND_HOLIDAYS);
	const seasonalTag = getSeasonalTag(ctx.now);
	return fetchWithCache(ctx, key, BackgroundTheme.SEASONS_AND_HOLIDAYS, seasonalTag);
};

const handleCustomBackground = (
	ctx: GetBackgroundContext,
	customBackground: string
): GetBackgroundResult => {
	const { cache, now, forceRefresh } = ctx;
	const trimmed = customBackground?.trim();

	if (!trimmed) {
		return { background: null, backgroundCache: cache };
	}

	const key = createCacheKey(BackgroundTheme.CUSTOM, trimmed);
	const cached = selectFromCache(cache, key, {
		now,
		forceRefresh,
	});

	if (cached?.background) {
		return {
			background: buildCachedBackground(cached.background),
			backgroundCache: cached.cache,
		};
	}

	const customItem: CachedBackgroundItem = {
		url: trimmed,
		date: now.toISOString(),
		theme: BackgroundTheme.CUSTOM,
	};

	logger.debug("Beautitab: Returning custom background item", customItem);

	const result = {
		background: buildCachedBackground(customItem),
		backgroundCache: updateCache(cache, key, customItem, { now }),
	};

	logger.debug("Beautitab: Custom background result", result);
	return result;
};

const handleLocalBackground = (
	cache: BackgroundCache,
	localBackgrounds: string[],
	now: Date
): GetBackgroundResult => {
	if (!localBackgrounds?.length) {
		return { background: null, backgroundCache: cache };
	}

	const randomIndex = Math.floor(Math.random() * localBackgrounds.length);
	return {
		background: {
			url: localBackgrounds[randomIndex],
			date: now,
			theme: BackgroundTheme.LOCAL,
		},
		backgroundCache: cache,
	};
};

const handleUnsplashTheme = (
	ctx: GetBackgroundContext,
	theme: BackgroundTheme
): Promise<GetBackgroundResult> => {
	const key = createCacheKey(theme);
	return fetchWithCache(ctx, key, theme, theme);
};

// ============================================================================
// Main Function
// ============================================================================

export const getBackground = async (
	backgroundTheme: BackgroundTheme,
	customBackground: string,
	localBackgrounds: string[],
	apiKey: string,
	backgroundCache?: BackgroundCache,
	forceRefresh: boolean = false,
	now: Date = new Date()
): Promise<GetBackgroundResult> => {
	try {
		logger.debug("Beautitab: getBackground called", {
			backgroundTheme,
			customBackground,
			forceRefresh,
			now: now.toISOString(),
		});

		const cache = normalizeBackgroundCache(backgroundCache);
		const ctx: GetBackgroundContext = { cache, now, forceRefresh, apiKey };

		switch (backgroundTheme) {
			case BackgroundTheme.SEASONS_AND_HOLIDAYS:
				return handleSeasonsAndHolidays(ctx);

			case BackgroundTheme.CUSTOM:
				return handleCustomBackground(ctx, customBackground);

			case BackgroundTheme.LOCAL:
				return handleLocalBackground(cache, localBackgrounds, now);

			case BackgroundTheme.TRANSPARENT_WITH_SHADOWS:
			case BackgroundTheme.TRANSPARENT:
				return { background: null, backgroundCache: cache };

			default:
				return handleUnsplashTheme(ctx, backgroundTheme);
		}
	} catch (error) {
		logger.error("Beautitab: Error in getBackground", error);
		const cache = normalizeBackgroundCache(backgroundCache);
		return { background: null, backgroundCache: cache };
	}
};
