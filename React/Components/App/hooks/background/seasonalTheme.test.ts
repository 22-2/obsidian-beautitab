import { describe, it, expect } from "vitest";
import { getSeasonalTag, getEasterDate, isWithinDaysBefore } from "./seasonalTheme";

describe("seasonalTheme", () => {
	describe("isWithinDaysBefore", () => {
		it("should return true if within range", () => {
			const dateA = new Date("2024-03-20");
			const dateB = new Date("2024-03-25");
			expect(isWithinDaysBefore(dateA, 5, dateB)).toBe(true);
		});

		it("should return false if outside range", () => {
			const dateA = new Date("2024-03-19");
			const dateB = new Date("2024-03-25");
			expect(isWithinDaysBefore(dateA, 5, dateB)).toBe(false);
		});

		it("should return false if dateA is after dateB", () => {
			const dateA = new Date("2024-03-26");
			const dateB = new Date("2024-03-25");
			expect(isWithinDaysBefore(dateA, 5, dateB)).toBe(false);
		});
	});

	describe("getEasterDate", () => {
		it("should calculate correct Easter for 2024", () => {
			const easter2024 = getEasterDate(2024);
			expect(easter2024.getMonth()).toBe(2); // March (0-indexed)
			expect(easter2024.getDate()).toBe(31);
		});

		it("should calculate correct Easter for 2025", () => {
			const easter2025 = getEasterDate(2025);
			expect(easter2025.getMonth()).toBe(3); // April
			expect(easter2025.getDate()).toBe(20);
		});
	});

	describe("getSeasonalTag", () => {
		it("should return NEW_YEARS on Jan 1st", () => {
			expect(getSeasonalTag(new Date("2024-01-01"))).toBe("fireworks");
		});

		it("should return WINTER in January", () => {
			expect(getSeasonalTag(new Date("2024-01-15"))).toBe("winter");
		});

		it("should return VALENTINES_DAY on Feb 14th", () => {
			expect(getSeasonalTag(new Date("2024-02-14"))).toBe("valentine");
		});

		it("should return EASTER near Easter date", () => {
			// Easter 2024 is March 31. March 27 is 4 days before.
			expect(getSeasonalTag(new Date("2024-03-27"))).toBe("easter");
		});

		it("should return HALLOWEEN on Oct 31st", () => {
			expect(getSeasonalTag(new Date("2024-10-31"))).toBe("helloween");
		});

		it("should return CHRISTMAS in December", () => {
			expect(getSeasonalTag(new Date("2024-12-25"))).toBe("christmas");
			expect(getSeasonalTag(new Date("2024-12-31"))).toBe("fireworks");
		});

		it("should return SUMMER in August", () => {
			expect(getSeasonalTag(new Date("2024-08-15"))).toBe("summer");
		});
	});
});
