// ============================================================================
// Background Cache Operations
// ============================================================================

import { isSameHour, differenceInMilliseconds, isValid } from "date-fns";
import {
	BackgroundCache,
	CACHE_MAX_ITEMS,
	CACHE_TTL_MINUTES,
	CachedBackgroundItem
} from "./types";

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Checks if a cached item is still fresh (within the same hour and TTL)
 */
const isFresh = (
	dateISO: string | Date,
	ttlMinutes: number,
	now: Date
): boolean => {
	const date = typeof dateISO === "string" ? new Date(dateISO) : dateISO;
	if (!isValid(date)) return false;

	// Different hour = not fresh
	if (!isSameHour(date, now)) {
		return false;
	}

	const diffMs = differenceInMilliseconds(now, date);
	return diffMs <= ttlMinutes * 60 * 1000;
};

// ============================================================================
// Public Cache Operations
// ============================================================================

/**
 * Normalizes a background cache, ensuring all entries have valid structure
 */
export const normalizeBackgroundCache = (
	cache?: BackgroundCache
): BackgroundCache => {
	if (!cache) return {};
	
	const normalized: BackgroundCache = {};
	for (const [key, value] of Object.entries(cache)) {
		normalized[key] = {
			items: Array.isArray(value?.items) ? value.items.filter(Boolean) : [],
			lastFetchedAt: value?.lastFetchedAt,
			ttlMinutes: value?.ttlMinutes ?? CACHE_TTL_MINUTES,
		};
	}
	return normalized;
};

export interface BackgroundSelectionResult {
	background?: CachedBackgroundItem;
	cache: BackgroundCache;
}

/**
 * Attempts to retrieve a fresh background or updates the cache with a new item
 */
export const selectFromCache = (
	cache: BackgroundCache,
	key: string,
	options: { now: Date; forceRefresh?: boolean; ttlMinutes?: number }
): BackgroundSelectionResult | null => {
	const entry = cache[key];
	if (!entry || options.forceRefresh) return null;

	const ttl = options.ttlMinutes ?? entry.ttlMinutes ?? CACHE_TTL_MINUTES;
	const freshItems = entry.items.filter((item) => isFresh(item.date, ttl, options.now));

	if (freshItems.length === 0) return null;

	// Always pick the newest fresh item
	const background = freshItems[0];

	return {
		background,
		cache: {
			...cache,
			[key]: { ...entry, items: freshItems },
		},
	};
};

/**
 * Updates the cache with newly fetched backgrounds
 */
export const updateCache = (
	cache: BackgroundCache,
	key: string,
	item: CachedBackgroundItem,
	options: { now: Date }
): BackgroundCache => {
	const existing = cache[key];
	const nowISO = options.now.toISOString();
	
	// Simply put the newest item at the start of the list
	const newItems = [
		{ ...item, date: item.date ?? nowISO },
		...(existing?.items ?? [])
	].slice(0, CACHE_MAX_ITEMS);

	return {
		...cache,
		[key]: {
			items: newItems,
			lastFetchedAt: nowISO,
			ttlMinutes: existing?.ttlMinutes ?? CACHE_TTL_MINUTES,
		},
	};
};

