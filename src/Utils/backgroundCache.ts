import { BackgroundCache, BackgroundCacheEntry, CachedBackgroundItem } from "src/Types/Interfaces";

export const CACHE_TTL_MINUTES = 60;
export const CACHE_BATCH_SIZE = 5;
export const CACHE_MAX_ITEMS = 15;

const clampIndex = (length: number, lastUsedIndex?: number): number => {
	if (length === 0) return -1;
	if (typeof lastUsedIndex !== "number" || lastUsedIndex < -1) return -1;
	return lastUsedIndex % length;
};

const isFresh = (dateISO: string | Date, ttlMinutes: number, now: Date): boolean => {
	const date = typeof dateISO === "string" ? new Date(dateISO) : dateISO;
	if (Number.isNaN(date.getTime())) return false;

	// If it's a different hour, it's not fresh (for the purpose of changing every hour)
	if (
		date.getHours() !== now.getHours() ||
		date.getDate() !== now.getDate() ||
		date.getMonth() !== now.getMonth() ||
		date.getFullYear() !== now.getFullYear()
	) {
		return false;
	}

	const diffMs = now.getTime() - date.getTime();
	return diffMs <= ttlMinutes * 60 * 1000;
};

export const normalizeBackgroundCache = (
	cache?: BackgroundCache
): BackgroundCache => {
	if (!cache) return {};
	return Object.entries(cache).reduce<BackgroundCache>((acc, [key, value]) => {
		const entry: BackgroundCacheEntry = {
			items: Array.isArray(value?.items) ? value.items.filter(Boolean) : [],
			lastUsedIndex: clampIndex(value?.items?.length ?? 0, value?.lastUsedIndex),
			lastFetchedAt: value?.lastFetchedAt,
			ttlMinutes: value?.ttlMinutes ?? CACHE_TTL_MINUTES,
		};
		acc[key] = entry;
		return acc;
	}, {});
};

export const takeCachedBackground = (
	cache: BackgroundCache,
	key: string,
	options: { now: Date; forceRefresh?: boolean; ttlMinutes?: number }
): { background?: CachedBackgroundItem; cache: BackgroundCache } | null => {
	const entry = cache[key];
	if (!entry) return null;
	if (options.forceRefresh) return { cache };
	const ttl = options.ttlMinutes ?? entry.ttlMinutes ?? CACHE_TTL_MINUTES;
	const now = options.now;
	const freshItems = entry.items.filter((item) => isFresh(item.date, ttl, now));
	if (!freshItems.length) {
		return {
			cache: {
				...cache,
				[key]: {
					...entry,
					items: [],
					lastUsedIndex: -1,
				},
			},
		};
	}

	const nextIndex = clampIndex(freshItems.length, entry.lastUsedIndex + 1);
	const background = freshItems[nextIndex];
	return {
		background,
		cache: {
			...cache,
			[key]: {
				...entry,
				items: freshItems,
				lastUsedIndex: nextIndex,
			},
		},
	};
};

export const hasFreshBackground = (
	cache: BackgroundCache,
	key: string,
	options: { now: Date; ttlMinutes?: number }
): boolean => {
	const entry = cache[key];
	if (!entry) return false;
	const ttl = options.ttlMinutes ?? entry.ttlMinutes ?? CACHE_TTL_MINUTES;
	return entry.items.some((item) => isFresh(item.date, ttl, options.now));
};

export const appendFetchedBackgrounds = (
	cache: BackgroundCache,
	key: string,
	items: CachedBackgroundItem[],
	options: { now: Date; maxItems?: number; ttlMinutes?: number }
): BackgroundCache => {
	const existing = cache[key];
	const ttl = options.ttlMinutes ?? existing?.ttlMinutes ?? CACHE_TTL_MINUTES;
	const nowISO = options.now.toISOString();
	const normalizedNew = items
		.filter((item) => !!item.url)
		.map((item) => ({
			...item,
			date: item.date ?? nowISO,
		}));

	const combined = [...normalizedNew, ...(existing?.items ?? [])];
	const seen = new Set<string>();
	const deduped: CachedBackgroundItem[] = [];
	for (const item of combined) {
		const keyUrl = item.url;
		if (seen.has(keyUrl)) continue;
		seen.add(keyUrl);
		deduped.push(item);
	}

	const maxItems = options.maxItems ?? CACHE_MAX_ITEMS;
	const trimmed = deduped.slice(0, maxItems);

	return {
		...cache,
		[key]: {
			items: trimmed,
			lastUsedIndex: -1,
			lastFetchedAt: nowISO,
			ttlMinutes: ttl,
		},
	};
};
