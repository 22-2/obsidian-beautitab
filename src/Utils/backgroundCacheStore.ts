import { del, get, set, createStore } from "idb-keyval";
import {
	BackgroundCache,
	CachedBackground,
} from "src/Types/Interfaces";
import {
	appendFetchedBackgrounds,
	normalizeBackgroundCache,
	CACHE_MAX_ITEMS,
	CACHE_TTL_MINUTES,
} from "src/Utils/backgroundCache";

// Dedicated IndexedDB database/store names for background cache
const CACHE_DB = "beautitab-idb";
const CACHE_STORE = "background-cache-store";
const CACHE_KEY = "backgroundCache";
const store = createStore(CACHE_DB, CACHE_STORE);

export const readBackgroundCache = async (): Promise<BackgroundCache> => {
	const cache = ((await get(CACHE_KEY, store)) as BackgroundCache | undefined) ?? {};
	return normalizeBackgroundCache(cache);
};

export const saveBackgroundCache = async (
	cache: BackgroundCache
): Promise<void> => {
	await set(CACHE_KEY, cache, store);
};

export const clearBackgroundCache = async (): Promise<void> => {
	await del(CACHE_KEY, store);
};

export const migrateBackgroundCache = async (
	legacyCache?: BackgroundCache,
	legacyCachedBackground?: CachedBackground
): Promise<void> => {
	const current = await readBackgroundCache();
	let merged = current;
	if (legacyCache && Object.keys(legacyCache).length) {
		merged = {
			...merged,
			...normalizeBackgroundCache(legacyCache),
		};
	}
	if (legacyCachedBackground?.url) {
		const key = legacyCachedBackground.theme
			? `unsplash:${legacyCachedBackground.theme}`
			: "legacy";
		merged = appendFetchedBackgrounds(
			merged,
			key,
			[
				{
					url: legacyCachedBackground.url,
					date: new Date(legacyCachedBackground.date).toISOString(),
					theme: legacyCachedBackground.theme,
				},
			],
			{
				now: new Date(),
				maxItems: CACHE_MAX_ITEMS,
				ttlMinutes: CACHE_TTL_MINUTES,
			}
		);
	}
	await saveBackgroundCache(merged);
};
