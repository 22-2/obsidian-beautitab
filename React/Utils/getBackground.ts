import { BackgroundTheme } from "src/Types/Enums";
import getEasterDate from "./getEasterDate";
import { isWithinDaysBefore } from "./isWithinXDays";
import { createApi } from "unsplash-js";
//@ts-ignore - This is a polyfill for fetch and work using --lib dom
import { fetch as fetchPolyfill } from "whatwg-fetch";
import {
	BackgroundCache,
	CachedBackground,
	CachedBackgroundItem,
} from "../../src/Types/Interfaces";
import {
	CACHE_BATCH_SIZE,
	CACHE_MAX_ITEMS,
	CACHE_TTL_MINUTES,
	appendFetchedBackgrounds,
	normalizeBackgroundCache,
	takeCachedBackground,
} from "src/Utils/backgroundCache";
import logger from "src/Utils/logger";

enum MONTH {
	JANUARY = 1,
	FEBUARY = 2,
	MARCH = 3,
	APRIL = 4,
	MAY = 5,
	JUNE = 6,
	JULY = 7,
	AUGUST = 8,
	SEPTEMBER = 9,
	OCTOBER = 10,
	NOVEMBER = 11,
	DECEMBER = 12,
}

enum SEASONAL_THEME {
	WINTER = "winter",
	NEW_YEARS = "fireworks",
	GROUNDHOG_DAY = "groundhog",
	VALENTINES_DAY = "valentine",
	WOMENS_DAY = "womensday",
	ST_PATRICS_DAY = "pub",
	PI_DAY = "pie",
	EASTER = "easter",
	APRIL_FOOLS = "laughing",
	SPRING = "spring",
	EARTH_DAY = "earth",
	STARWARS = "yoda",
	CINCO_DE_MAYO = "mexico",
	SUMMER = "summer",
	FLAG_DAY = "america,flag",
	JUNETEENTH = "juneteenth",
	INDIGENOUS_PEOPLES_DAY = "firstnations",
	CANADA_DAY = "fireworks",
	JULY_FIRST = "fireworks",
	FALL = "fall",
	HALLOWEEN = "helloween",
	REMEMBERANCE_DAY = "veteran",
	CHRISTMAS = "christmas",
}

/**
 * Normalize Unsplash URLs to a lower quality variant so we get a softer, blur-friendly image.
 */
const maybeLowerQualityUnsplashUrl = (url: string) => {
	if (!url.includes("images.unsplash.com")) return url;
	try {
		const u = new URL(url);
		// Keep existing query params (ixid/ixlib) for access control, but override format/quality
		// u.search = ""; // Don't clear search - it breaks signature/access for some URLs
		u.searchParams.set("auto", "format");
		u.searchParams.set("fit", "crop");
		u.searchParams.set("w", "1600");
		u.searchParams.set("q", "20");
		return u.toString();
	} catch {
		const separator = url.includes("?") ? "&" : "?";
		return `${url}${separator}auto=format&fit=crop&w=1600&q=20`;
	}
};

/**
 * Given a date, returns a seasonal tag for use in background generation
 * @param date
 */
const getSeasonalTag = (date: Date) => {
	const month = date.getMonth() + 1;
	const day = date.getDate();
	const year = date.getFullYear();

	// Easter is an edge case cause it's a silly calculation
	const easter = getEasterDate(year);
	if (isWithinDaysBefore(date, 5, easter)) {
		return SEASONAL_THEME.EASTER;
	}

	switch (month) {
		case MONTH.JANUARY:
			return day === 1 ? SEASONAL_THEME.NEW_YEARS : SEASONAL_THEME.WINTER;
		case MONTH.FEBUARY:
			switch (day) {
				case 2:
					return SEASONAL_THEME.GROUNDHOG_DAY;
				case 14:
					return SEASONAL_THEME.VALENTINES_DAY;
				default:
					return SEASONAL_THEME.WINTER;
			}
		case MONTH.MARCH:
			switch (day) {
				case 8:
					return SEASONAL_THEME.WOMENS_DAY;
				case 14:
					return SEASONAL_THEME.PI_DAY;
				case 17:
					return SEASONAL_THEME.ST_PATRICS_DAY;
				default:
					return SEASONAL_THEME.WINTER;
			}
		case MONTH.APRIL: {
			switch (day) {
				case 1:
					return SEASONAL_THEME.APRIL_FOOLS;
				case 22:
					return SEASONAL_THEME.EARTH_DAY;
				default:
					return SEASONAL_THEME.SPRING;
			}
		}
		case MONTH.MAY: {
			switch (day) {
				case 4:
					return SEASONAL_THEME.STARWARS;
				case 5:
					return SEASONAL_THEME.CINCO_DE_MAYO;
				default:
					return SEASONAL_THEME.SPRING;
			}
		}
		case MONTH.JUNE: {
			switch (day) {
				case 14:
					return SEASONAL_THEME.FLAG_DAY;
				case 19:
					return SEASONAL_THEME.JUNETEENTH;
				case 21:
					return SEASONAL_THEME.INDIGENOUS_PEOPLES_DAY;
				default:
					return SEASONAL_THEME.SUMMER;
			}
		}
		case MONTH.JULY: {
			switch (day) {
				case 1:
					return SEASONAL_THEME.CANADA_DAY;
				case 4:
					return SEASONAL_THEME.JULY_FIRST;
				default:
					return SEASONAL_THEME.SUMMER;
			}
		}
		case MONTH.AUGUST: {
			return SEASONAL_THEME.SUMMER;
		}
		case MONTH.SEPTEMBER: {
			return SEASONAL_THEME.SUMMER;
		}
		case MONTH.OCTOBER:
			return day === 31 ? SEASONAL_THEME.HALLOWEEN : SEASONAL_THEME.FALL;
		case MONTH.NOVEMBER:
			return day === 11
				? SEASONAL_THEME.REMEMBERANCE_DAY
				: SEASONAL_THEME.FALL;
		case MONTH.DECEMBER:
			return day === 31
				? SEASONAL_THEME.NEW_YEARS
				: SEASONAL_THEME.CHRISTMAS;
	}
};

/**
 * Gets the background URL based on the theme settings, either for a specific theme, based on the season, or a custom background
 * @param backgroundTheme
 * @param customBackground
 */
export interface GetBackgroundResult {
	background: CachedBackground | null;
	backgroundCache?: BackgroundCache;
}

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

const getBackground = async (
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
		const cacheKey = (theme: BackgroundTheme, url?: string) =>
			theme === BackgroundTheme.CUSTOM && url
				? `custom:${url}`
				: `unsplash:${theme}`;

		switch (backgroundTheme) {
		case BackgroundTheme.SEASONS_AND_HOLIDAYS: {
			const key = cacheKey(backgroundTheme);
			const cached = takeCachedBackground(cache, key, {
				now,
				forceRefresh,
				ttlMinutes: CACHE_TTL_MINUTES,
			});
			if (cached?.background) {
				return {
					background: buildCachedBackground(cached.background),
					backgroundCache: cached.cache,
				};
			}

			if (apiKey.length === 0) {
				return { background: null, backgroundCache: cache };
			}

			const seasonalTag = getSeasonalTag(now);
			const seasonHolidays = await createApi({
				accessKey: apiKey,
				fetch: fetchPolyfill,
			})
				.photos.getRandom({
					query: seasonalTag,
					count: CACHE_BATCH_SIZE,
				})
				.then((result) => result.response);

			const items: CachedBackgroundItem[] = (seasonHolidays
				? seasonHolidays instanceof Array
					? seasonHolidays
					: [seasonHolidays]
				: []
			).map((item) => ({
				url: maybeLowerQualityUnsplashUrl(item.urls.raw),
				date: now.toISOString(),
				theme: backgroundTheme,
			}));

			const updatedCache = appendFetchedBackgrounds(cache, key, items, {
				now,
				maxItems: CACHE_MAX_ITEMS,
				ttlMinutes: CACHE_TTL_MINUTES,
			});
			const next = takeCachedBackground(updatedCache, key, {
				now,
				forceRefresh: false,
				ttlMinutes: CACHE_TTL_MINUTES,
			});
			return {
				background: buildCachedBackground(next?.background ?? items[0]),
				backgroundCache: next?.cache ?? updatedCache,
			};
		}
		case BackgroundTheme.CUSTOM: {
			const trimmed = customBackground?.trim();
			if (!trimmed) {
				return { background: null, backgroundCache: cache };
			}
			const key = cacheKey(backgroundTheme, trimmed);
			const cached = takeCachedBackground(cache, key, {
				now,
				forceRefresh,
				ttlMinutes: CACHE_TTL_MINUTES,
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
				theme: backgroundTheme,
			};
            logger.debug("Beautitab: Returning custom background item", customItem);
			const result = {
				background: buildCachedBackground(customItem),
				backgroundCache: appendFetchedBackgrounds(cache, key, [customItem], {
					now,
					maxItems: CACHE_MAX_ITEMS,
					ttlMinutes: CACHE_TTL_MINUTES,
				}),
			};
			logger.debug("Beautitab: Custom background result", result);
			return result;
		}
		case BackgroundTheme.LOCAL:
			if (!localBackgrounds?.length) {
				return { background: null, backgroundCache: cache };
			}
			return {
				background: {
					url: localBackgrounds[
						Math.floor(Math.random() * localBackgrounds.length)
					],
					date: now,
					theme: backgroundTheme,
				},
				backgroundCache: cache,
			};
		case BackgroundTheme.TRANSPARENT_WITH_SHADOWS:
		case BackgroundTheme.TRANSPARENT:
			return { background: null, backgroundCache: cache };
		default: {
			const key = cacheKey(backgroundTheme);
			const cached = takeCachedBackground(cache, key, {
				now,
				forceRefresh,
				ttlMinutes: CACHE_TTL_MINUTES,
			});
			if (cached?.background) {
				return {
					background: buildCachedBackground(cached.background),
					backgroundCache: cached.cache,
				};
			}

			if (apiKey.length === 0) {
				return { background: null, backgroundCache: cache };
			}

			const defRandom = await createApi({
				accessKey: apiKey,
				fetch: fetchPolyfill,
			})
				.photos.getRandom({
					count: CACHE_BATCH_SIZE,
					query: backgroundTheme,
				})
				.then((result) => result.response);
			const items: CachedBackgroundItem[] = (defRandom
				? defRandom instanceof Array
					? defRandom
					: [defRandom]
				: []
			).map((item) => ({
				url: maybeLowerQualityUnsplashUrl(item.urls.raw),
				date: now.toISOString(),
				theme: backgroundTheme,
			}));

			const updatedCache = appendFetchedBackgrounds(cache, key, items, {
				now,
				maxItems: CACHE_MAX_ITEMS,
				ttlMinutes: CACHE_TTL_MINUTES,
			});
			const next = takeCachedBackground(updatedCache, key, {
				now,
				forceRefresh: false,
				ttlMinutes: CACHE_TTL_MINUTES,
			});
			return {
				background: buildCachedBackground(next?.background ?? items[0]),
				backgroundCache: next?.cache ?? updatedCache,
			};
		}
		}
	} catch (error) {
		logger.error("Beautitab: Error in getBackground", error);
		const cache = normalizeBackgroundCache(backgroundCache);
		return { background: null, backgroundCache: cache };
	}
};

export default getBackground;
