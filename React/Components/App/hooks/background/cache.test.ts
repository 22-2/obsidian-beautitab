import { describe, it, expect } from "vitest";
import {
	normalizeBackgroundCache,
	selectFromCache,
	updateCache,
} from "./cache";
import { BackgroundCache, CACHE_TTL_MINUTES } from "./types";

describe("background cache", () => {
	const now = new Date("2024-01-01T12:00:00Z");
	const freshDate = now.toISOString();
	const staleDate = new Date("2024-01-01T11:00:00Z").toISOString();
	const key = "test-key";

	describe("normalizeBackgroundCache", () => {
		it("should return empty object if cache is undefined", () => {
			expect(normalizeBackgroundCache(undefined)).toEqual({});
		});

		it("should fill missing default values", () => {
			const rawCache: any = {
				[key]: {
					items: [{ url: "test", date: freshDate }],
				},
			};
			const normalized = normalizeBackgroundCache(rawCache);
			expect(normalized[key].ttlMinutes).toBe(CACHE_TTL_MINUTES);
		});
	});

	describe("selectFromCache", () => {
		it("should return null if key doesn't exist", () => {
			expect(selectFromCache({}, key, { now })).toBeNull();
		});

		it("should return the first fresh background", () => {
			const cache: BackgroundCache = {
				[key]: {
					items: [
						{ url: "url1", date: freshDate },
						{ url: "url2", date: freshDate },
					],
					ttlMinutes: 60,
				},
			};
			const result = selectFromCache(cache, key, { now });
			expect(result?.background?.url).toBe("url1");
		});

		it("should return null if forceRefresh is true", () => {
			const cache: BackgroundCache = {
				[key]: {
					items: [{ url: "url1", date: freshDate }],
				},
			};
			const result = selectFromCache(cache, key, { now, forceRefresh: true });
			expect(result).toBeNull();
		});

		it("should return null if no fresh background exists", () => {
			const cache: BackgroundCache = {
				[key]: {
					items: [{ url: "stale", date: staleDate }],
				},
			};
			const result = selectFromCache(cache, key, { now });
			expect(result).toBeNull();
		});
	});

	describe("updateCache", () => {
		it("should add new item at the beginning", () => {
			const cache: BackgroundCache = {
				[key]: {
					items: [{ url: "old", date: freshDate }],
				},
			};
			const newItem = { url: "new", date: freshDate };
			const updated = updateCache(cache, key, newItem, { now });
			
			expect(updated[key].items).toHaveLength(2);
			expect(updated[key].items[0].url).toBe("new");
		});

		it("should respect maxItems", () => {
			const cache: BackgroundCache = { [key]: { items: [] } };
			let currentCache = cache;
			for(let i=0; i<20; i++) {
				currentCache = updateCache(currentCache, key, { url: `u${i}`, date: freshDate }, { now });
			}
			expect(currentCache[key].items).toHaveLength(15);
			expect(currentCache[key].items[0].url).toBe("u19");
		});
	});
});
