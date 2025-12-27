import { describe, it, expect } from "vitest";
import { hasFreshBackground } from "./backgroundCache";
import { BackgroundTheme } from "src/Types/Enums";
import { BackgroundCache } from "src/Types/Interfaces";

describe("backgroundCache", () => {
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
	});
});
