import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchNewBackground } from "./backgroundFetcher";
import { BackgroundTheme } from "src/Types/Enums";
import getBackground from "React/Utils/getBackground";
import { LocalImageCache } from "src/Utils/LocalImageCache";

// Mock dependencies
vi.mock("React/Utils/getBackground");
vi.mock("src/Utils/LocalImageCache");
vi.mock("main");

describe("backgroundFetcher", () => {
	let mockPlugin: any;
	let mockSettings: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockSettings = {
			backgroundTheme: BackgroundTheme.FOREST,
			customBackground: "",
			localBackgrounds: [],
			apiKey: "test-api-key",
			backgroundCache: {},
			debugRefreshBackgroundOnOpen: false,
		};

		mockPlugin = {
			settings: mockSettings,
			saveSettings: vi.fn().mockResolvedValue(undefined),
		};

		// Mock LocalImageCache implementation
		(LocalImageCache as any).mockImplementation(function() {
			return {
				saveImage: vi.fn().mockResolvedValue("local-path"),
				pruneCache: vi.fn().mockResolvedValue(undefined),
			};
		});
	});

	it("should fetch a new background and update settings cache", async () => {
		const mockResult = {
			background: {
				url: "http://example.com/image.jpg",
				date: new Date(),
				theme: BackgroundTheme.FOREST,
			},
			backgroundCache: { "unsplash:forest": { items: [], lastUsedIndex: 0 } },
		};

		(getBackground as any).mockResolvedValue(mockResult);

		const result = await fetchNewBackground({
			settings: mockSettings,
			plugin: mockPlugin,
		});

		expect(getBackground).toHaveBeenCalled();
		expect(mockPlugin.settings.backgroundCache).toEqual(mockResult.backgroundCache);
		expect(mockPlugin.saveSettings).toHaveBeenCalled();
		expect(result?.url).toBe("local-path"); // Should be the local path from LocalImageCache
	});

	it("should not update settings if backgroundCache is not returned", async () => {
		const mockResult = {
			background: {
				url: "http://example.com/image.jpg",
				date: new Date(),
				theme: BackgroundTheme.FOREST,
			},
		};

		(getBackground as any).mockResolvedValue(mockResult);

		await fetchNewBackground({
			settings: mockSettings,
			plugin: mockPlugin,
		});

		expect(mockPlugin.saveSettings).not.toHaveBeenCalled();
	});
});
