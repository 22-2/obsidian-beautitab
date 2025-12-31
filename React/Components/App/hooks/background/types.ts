// ============================================================================
// Background Types & Constants
// ============================================================================

export interface SearchProvider {
	command: string;
	display: string;
}

export interface CustomQuote {
	text: string;
	author: string;
}

export interface CachedBackground {
	url: string;
	date: Date;
	theme?: BackgroundTheme;
}

export interface CachedBackgroundItem {
	url: string;
	date: string;
	theme?: BackgroundTheme;
	attribution?: string;
	width?: number;
	height?: number;
}

export interface BackgroundCacheEntry {
	items: CachedBackgroundItem[];
	lastFetchedAt?: string;
	ttlMinutes?: number;
}

export type BackgroundCache = Record<string, BackgroundCacheEntry>;

export interface GetBackgroundResult {
	background: CachedBackground | null;
	backgroundCache?: BackgroundCache;
}


// ============================================================================
// Constants
// ============================================================================

export const CACHE_TTL_MINUTES = 60;
export const CACHE_BATCH_SIZE = 1;
export const CACHE_MAX_ITEMS = 15;

// ============================================================================
// Theme Enums (as const objects)
// ============================================================================

export const BackgroundTheme = {
	SEASONS_AND_HOLIDAYS: "seasons and holidays",
	WINTER: "winter",
	SPRING: "spring",
	SUMMER: "summer",
	FALL: "fall",
	MOUNTAIN: "mountains",
	LAKES: "lakes",
	FOREST: "forest",
	ANIMALS: "animals",
	CUSTOM: "custom",
	LOCAL: "local",
	TRANSPARENT: "transparent",
	TRANSPARENT_WITH_SHADOWS: "transparent with shadows",
} as const;
export type BackgroundTheme = (typeof BackgroundTheme)[keyof typeof BackgroundTheme];

export const TIME_FORMAT = {
	TWELVE_HOUR: "12-hour",
	TWENTY_FOUR_HOUR: "24-hour",
} as const;
export type TIME_FORMAT = (typeof TIME_FORMAT)[keyof typeof TIME_FORMAT];

export const BOOKMARK_SOURCE = {
	ALL: "all",
	GROUP: "group",
} as const;
export type BOOKMARK_SOURCE = (typeof BOOKMARK_SOURCE)[keyof typeof BOOKMARK_SOURCE];

export const QUOTE_SOURCE = {
	QUOTEABLE: "Quoteable",
	MY_QUOTES: "My quotes",
	BOTH: "Both",
} as const;
export type QUOTE_SOURCE = (typeof QUOTE_SOURCE)[keyof typeof QUOTE_SOURCE];

export const NEW_TAB_BEHAVIOR = {
	OVERRIDE: "Override New Tab command",
	NONE: "None",
} as const;
export type NEW_TAB_BEHAVIOR = (typeof NEW_TAB_BEHAVIOR)[keyof typeof NEW_TAB_BEHAVIOR];
