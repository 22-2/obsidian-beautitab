import { describe, it, expect } from "vitest";
import {
	hasFreshBackground,
	takeCachedBackground,
	appendFetchedBackgrounds,
	normalizeBackgroundCache,
	CACHE_TTL_MINUTES,
	CACHE_MAX_ITEMS,
} from "./backgroundCache";
import { BackgroundTheme } from "src/Types/Enums";
import { BackgroundCache } from "src/Types/Interfaces";

describe("backgroundCache", () => {
	describe("normalizeBackgroundCache", () => {
		it("should return empty object for undefined input", () => {
			expect(normalizeBackgroundCache(undefined)).toEqual({});
		});

		it("should return empty object for empty input", () => {
			expect(normalizeBackgroundCache({})).toEqual({});
		});

		it("should normalize cache entries with default TTL", () => {
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [{ url: "test-url", date: "2025-12-28T10:00:00" }],
					lastUsedIndex: 0,
				},
			};

			const result = normalizeBackgroundCache(cache);

			expect(result["unsplash:forest"].ttlMinutes).toBe(CACHE_TTL_MINUTES);
			expect(result["unsplash:forest"].items).toHaveLength(1);
		});

		it("should filter out falsy items", () => {
			const cache = {
				"unsplash:forest": {
					items: [
						{ url: "test-url", date: "2025-12-28T10:00:00" },
						null,
						undefined,
					],
					lastUsedIndex: 0,
				},
			} as unknown as BackgroundCache;

			const result = normalizeBackgroundCache(cache);

			expect(result["unsplash:forest"].items).toHaveLength(1);
		});

		it("should clamp lastUsedIndex to valid range", () => {
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [{ url: "url1", date: "2025-12-28T10:00:00" }],
					lastUsedIndex: 100, // Out of range
				},
			};

			const result = normalizeBackgroundCache(cache);

			expect(result["unsplash:forest"].lastUsedIndex).toBe(0);
		});

		it("should set lastUsedIndex to -1 for empty items", () => {
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [],
					lastUsedIndex: 5,
				},
			};

			const result = normalizeBackgroundCache(cache);

			expect(result["unsplash:forest"].lastUsedIndex).toBe(-1);
		});
	});

	describe("hasFreshBackground", () => {
		it("should return true if there is a background for the current hour", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [
						{
							url: "test-url",
							date: "2025-12-28T10:00:00",
							theme: BackgroundTheme.FOREST,
						},
					],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};

			expect(hasFreshBackground(cache, "unsplash:forest", { now })).toBe(true);
		});

		it("should return false if the background is from a previous hour", () => {
			const now = new Date("2025-12-28T11:00:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [
						{
							url: "test-url",
							date: "2025-12-28T10:59:59",
							theme: BackgroundTheme.FOREST,
						},
					],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};

			expect(hasFreshBackground(cache, "unsplash:forest", { now })).toBe(false);
		});

		it("should return false if the background is from a previous day", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [
						{
							url: "test-url",
							date: "2025-12-27T10:30:00",
							theme: BackgroundTheme.FOREST,
						},
					],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};

			expect(hasFreshBackground(cache, "unsplash:forest", { now })).toBe(false);
		});

		it("should return false if the cache key does not exist", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {};

			expect(hasFreshBackground(cache, "unsplash:nature", { now })).toBe(false);
		});

		it("should use custom ttlMinutes when provided", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [{ url: "test-url", date: "2025-12-28T10:00:00" }],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};

			// With 20 min TTL, 30 min old item should be stale
			expect(hasFreshBackground(cache, "unsplash:forest", { now, ttlMinutes: 20 })).toBe(false);
		});
	});


	describe("takeCachedBackground", () => {
		it("should return null if cache key does not exist", () => {
			const cache: BackgroundCache = {};
			const result = takeCachedBackground(cache, "unsplash:forest", {
				now: new Date("2025-12-28T10:30:00"),
			});

			expect(result).toBeNull();
		});

		it("should return cache only when forceRefresh is true", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [{ url: "test-url", date: "2025-12-28T10:00:00" }],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};

			const result = takeCachedBackground(cache, "unsplash:forest", {
				now,
				forceRefresh: true,
			});

			expect(result?.background).toBeUndefined();
			expect(result?.cache).toBeDefined();
		});

		it("should return next background and increment index", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [
						{ url: "url1", date: "2025-12-28T10:00:00" },
						{ url: "url2", date: "2025-12-28T10:05:00" },
					],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};

			const result = takeCachedBackground(cache, "unsplash:forest", { now });

			expect(result?.background?.url).toBe("url2");
			expect(result?.cache["unsplash:forest"].lastUsedIndex).toBe(1);
		});

		it("should wrap around to first item when reaching end", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [
						{ url: "url1", date: "2025-12-28T10:00:00" },
						{ url: "url2", date: "2025-12-28T10:05:00" },
					],
					lastUsedIndex: 1,
					ttlMinutes: 60,
				},
			};

			const result = takeCachedBackground(cache, "unsplash:forest", { now });

			expect(result?.background?.url).toBe("url1");
			expect(result?.cache["unsplash:forest"].lastUsedIndex).toBe(0);
		});

		it("should filter out stale items and reset index", () => {
			const now = new Date("2025-12-28T11:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [
						{ url: "stale-url", date: "2025-12-28T10:00:00" }, // Previous hour
						{ url: "fresh-url", date: "2025-12-28T11:00:00" }, // Current hour
					],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};

			const result = takeCachedBackground(cache, "unsplash:forest", { now });

			expect(result?.background?.url).toBe("fresh-url");
			expect(result?.cache["unsplash:forest"].items).toHaveLength(1);
		});

		it("should return empty items when all are stale", () => {
			const now = new Date("2025-12-28T12:00:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [
						{ url: "url1", date: "2025-12-28T10:00:00" },
						{ url: "url2", date: "2025-12-28T10:30:00" },
					],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};

			const result = takeCachedBackground(cache, "unsplash:forest", { now });

			expect(result?.background).toBeUndefined();
			expect(result?.cache["unsplash:forest"].items).toHaveLength(0);
			expect(result?.cache["unsplash:forest"].lastUsedIndex).toBe(-1);
		});
	});

	describe("appendFetchedBackgrounds", () => {
		it("should add new items to empty cache", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {};
			const newItems = [
				{ url: "url1", date: "2025-12-28T10:00:00" },
				{ url: "url2", date: "2025-12-28T10:05:00" },
			];

			const result = appendFetchedBackgrounds(cache, "unsplash:forest", newItems, { now });

			expect(result["unsplash:forest"].items).toHaveLength(2);
			expect(result["unsplash:forest"].lastUsedIndex).toBe(-1);
			expect(result["unsplash:forest"].lastFetchedAt).toBe(now.toISOString());
		});

		it("should prepend new items to existing cache", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [{ url: "existing-url", date: "2025-12-28T09:00:00" }],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};
			const newItems = [{ url: "new-url", date: "2025-12-28T10:00:00" }];

			const result = appendFetchedBackgrounds(cache, "unsplash:forest", newItems, { now });

			expect(result["unsplash:forest"].items[0].url).toBe("new-url");
			expect(result["unsplash:forest"].items[1].url).toBe("existing-url");
		});

		it("should dedupe items by URL", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {
				"unsplash:forest": {
					items: [{ url: "duplicate-url", date: "2025-12-28T09:00:00" }],
					lastUsedIndex: 0,
					ttlMinutes: 60,
				},
			};
			const newItems = [
				{ url: "duplicate-url", date: "2025-12-28T10:00:00" },
				{ url: "unique-url", date: "2025-12-28T10:05:00" },
			];

			const result = appendFetchedBackgrounds(cache, "unsplash:forest", newItems, { now });

			expect(result["unsplash:forest"].items).toHaveLength(2);
			// New duplicate should take precedence (comes first)
			expect(result["unsplash:forest"].items[0].url).toBe("duplicate-url");
			expect(result["unsplash:forest"].items[0].date).toBe("2025-12-28T10:00:00");
		});

		it("should trim items to maxItems", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {};
			const newItems = Array.from({ length: 20 }, (_, i) => ({
				url: `url-${i}`,
				date: now.toISOString(),
			}));

			const result = appendFetchedBackgrounds(cache, "unsplash:forest", newItems, { now });

			expect(result["unsplash:forest"].items).toHaveLength(CACHE_MAX_ITEMS);
		});

		it("should use custom maxItems when provided", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {};
			const newItems = Array.from({ length: 10 }, (_, i) => ({
				url: `url-${i}`,
				date: now.toISOString(),
			}));

			const result = appendFetchedBackgrounds(cache, "unsplash:forest", newItems, {
				now,
				maxItems: 5,
			});

			expect(result["unsplash:forest"].items).toHaveLength(5);
		});

		it("should filter out items without URL", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {};
			const newItems = [
				{ url: "valid-url", date: "2025-12-28T10:00:00" },
				{ url: "", date: "2025-12-28T10:05:00" },
				{ url: "another-valid", date: "2025-12-28T10:10:00" },
			];

			const result = appendFetchedBackgrounds(cache, "unsplash:forest", newItems, { now });

			expect(result["unsplash:forest"].items).toHaveLength(2);
		});

		it("should add current timestamp as date if not provided", () => {
			const now = new Date("2025-12-28T10:30:00");
			const cache: BackgroundCache = {};
			const newItems = [{ url: "url-without-date" } as any];

			const result = appendFetchedBackgrounds(cache, "unsplash:forest", newItems, { now });

			expect(result["unsplash:forest"].items[0].date).toBe(now.toISOString());
		});
	});
});
