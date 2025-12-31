import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBackground } from "./index";
import { BackgroundTheme } from "./types";
import * as unsplashApi from "./unsplashApi";

vi.mock("./unsplashApi", () => ({
	fetchFromUnsplashApi: vi.fn(),
	maybeLowerQualityUnsplashUrl: vi.fn((url) => url),
}));

describe("getBackground main function", () => {
	const apiKey = "mock-api-key";
	const now = new Date("2024-01-01T12:00:00Z");

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("should return null results for transparent themes", async () => {
		const result = await getBackground(BackgroundTheme.TRANSPARENT, "", [], apiKey, {});
		expect(result.background).toBeNull();
		expect(result.backgroundCache).toEqual({});
	});

	it("should handle custom background without trimming correctly", async () => {
		const customUrl = "  https://example.com/bg.jpg  ";
		const result = await getBackground(BackgroundTheme.CUSTOM, customUrl, [], apiKey, {}, false, now);
		
		expect(result.background?.url).toBe("https://example.com/bg.jpg");
		expect(result.backgroundCache!["custom:https://example.com/bg.jpg"]).toBeDefined();
	});

	it("should pick a random local background", async () => {
		const localBgs = ["bg1.jpg", "bg2.jpg", "bg3.jpg"];
		const result = await getBackground(BackgroundTheme.LOCAL, "", localBgs, apiKey, {}, false, now);
		
		expect(localBgs).toContain(result.background?.url);
		expect(result.background?.theme).toBe(BackgroundTheme.LOCAL);
	});

	it("should fetch from unsplash if cache is empty", async () => {
		const mockItem = {
			url: "https://unsplash.com/photo.jpg",
			date: now.toISOString(),
			theme: BackgroundTheme.MOUNTAIN
		};
		vi.mocked(unsplashApi.fetchFromUnsplashApi).mockResolvedValue(mockItem);

		const result = await getBackground(BackgroundTheme.MOUNTAIN, "", [], apiKey, {}, false, now);

		expect(unsplashApi.fetchFromUnsplashApi).toHaveBeenCalledWith(apiKey, BackgroundTheme.MOUNTAIN, BackgroundTheme.MOUNTAIN, now);
		expect(result.background?.url).toBe(mockItem.url);
		expect(result.backgroundCache!["unsplash:mountains"].items[0].url).toBe(mockItem.url);
	});

	it("should return null background if API key is missing and cache is empty", async () => {
		const result = await getBackground(BackgroundTheme.MOUNTAIN, "", [], "", {}, false, now);
		expect(result.background).toBeNull();
	});

	it("should use cached version if fresh", async () => {
		const cache: any = {
			"unsplash:mountains": {
				items: [{ url: "cached.jpg", date: now.toISOString(), theme: BackgroundTheme.MOUNTAIN }],
				ttlMinutes: 60
			}
		};

		const result = await getBackground(BackgroundTheme.MOUNTAIN, "", [], apiKey, cache, false, now);

		expect(unsplashApi.fetchFromUnsplashApi).not.toHaveBeenCalled();
		expect(result.background?.url).toBe("cached.jpg");
	});
});
