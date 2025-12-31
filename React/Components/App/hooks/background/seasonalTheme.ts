import {
	isBefore,
	differenceInMilliseconds,
	getMonth,
	getDate,
	getYear,
	isSameDay,
} from "date-fns";

// ============================================================================
// Date Helpers
// ============================================================================

/**
 * Returns true if dateA is within X days before dateB
 */
export const isWithinDaysBefore = (
	dateA: Date,
	days: number,
	dateB: Date
): boolean => {
	const daysInMilliseconds = days * 24 * 60 * 60 * 1000;
	return isBefore(dateA, dateB) && differenceInMilliseconds(dateB, dateA) <= daysInMilliseconds;
};

/**
 * Calculates Easter date for a given year using the Meeus/Jones/Butcher algorithm.
 * This is the standard algorithm for calculating Gregorian Easter.
 */
export const getEasterDate = (year: number): Date => {
	const a = year % 19;
	const b = Math.floor(year / 100);
	const c = year % 100;
	const d = Math.floor(b / 4);
	const e = b % 4;
	const f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3);
	const h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4);
	const k = c % 4;
	const l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;

	return new Date(year, month - 1, day);
};

// ============================================================================
// Month & Seasonal Theme Constants
// ============================================================================

const MONTH = {
	JANUARY: 0,
	FEBRUARY: 1,
	MARCH: 2,
	APRIL: 3,
	MAY: 4,
	JUNE: 5,
	JULY: 6,
	AUGUST: 7,
	SEPTEMBER: 8,
	OCTOBER: 9,
	NOVEMBER: 10,
	DECEMBER: 11,
} as const;

const SEASONAL_THEME = {
	WINTER: "winter",
	NEW_YEARS: "fireworks",
	GROUNDHOG_DAY: "groundhog",
	VALENTINES_DAY: "valentine",
	WOMENS_DAY: "womensday",
	ST_PATRICS_DAY: "pub",
	PI_DAY: "pie",
	EASTER: "easter",
	APRIL_FOOLS: "laughing",
	SPRING: "spring",
	EARTH_DAY: "earth",
	STARWARS: "yoda",
	CINCO_DE_MAYO: "mexico",
	SUMMER: "summer",
	FLAG_DAY: "america,flag",
	JUNETEENTH: "juneteenth",
	INDIGENOUS_PEOPLES_DAY: "firstnations",
	CANADA_DAY: "fireworks",
	JULY_FIRST: "fireworks",
	FALL: "fall",
	HALLOWEEN: "helloween",
	REMEMBERANCE_DAY: "veteran",
	CHRISTMAS: "christmas",
} as const;

type SeasonalTheme = (typeof SEASONAL_THEME)[keyof typeof SEASONAL_THEME];

// ============================================================================
// Holiday Mappings
// ============================================================================

type HolidayMap = Record<number, SeasonalTheme>;

const FEBRUARY_HOLIDAYS: HolidayMap = {
	2: SEASONAL_THEME.GROUNDHOG_DAY,
	14: SEASONAL_THEME.VALENTINES_DAY,
};

const MARCH_HOLIDAYS: HolidayMap = {
	8: SEASONAL_THEME.WOMENS_DAY,
	14: SEASONAL_THEME.PI_DAY,
	17: SEASONAL_THEME.ST_PATRICS_DAY,
};

const APRIL_HOLIDAYS: HolidayMap = {
	1: SEASONAL_THEME.APRIL_FOOLS,
	22: SEASONAL_THEME.EARTH_DAY,
};

const MAY_HOLIDAYS: HolidayMap = {
	4: SEASONAL_THEME.STARWARS,
	5: SEASONAL_THEME.CINCO_DE_MAYO,
};

const JUNE_HOLIDAYS: HolidayMap = {
	14: SEASONAL_THEME.FLAG_DAY,
	19: SEASONAL_THEME.JUNETEENTH,
	21: SEASONAL_THEME.INDIGENOUS_PEOPLES_DAY,
};

const JULY_HOLIDAYS: HolidayMap = {
	1: SEASONAL_THEME.CANADA_DAY,
	4: SEASONAL_THEME.JULY_FIRST,
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Returns a seasonal/holiday tag for Unsplash search based on the date
 */
export const getSeasonalTag = (date: Date): SeasonalTheme => {
	const month = getMonth(date);
	const day = getDate(date);
	const year = getYear(date);

	// Easter check (special calculation)
	const easter = getEasterDate(year);
	if (isWithinDaysBefore(date, 5, easter)) {
		return SEASONAL_THEME.EASTER;
	}

	switch (month) {
		case MONTH.JANUARY:
			return day === 1 ? SEASONAL_THEME.NEW_YEARS : SEASONAL_THEME.WINTER;

		case MONTH.FEBRUARY:
			return FEBRUARY_HOLIDAYS[day] ?? SEASONAL_THEME.WINTER;

		case MONTH.MARCH:
			return MARCH_HOLIDAYS[day] ?? SEASONAL_THEME.WINTER;

		case MONTH.APRIL:
			return APRIL_HOLIDAYS[day] ?? SEASONAL_THEME.SPRING;

		case MONTH.MAY:
			return MAY_HOLIDAYS[day] ?? SEASONAL_THEME.SPRING;

		case MONTH.JUNE:
			return JUNE_HOLIDAYS[day] ?? SEASONAL_THEME.SUMMER;

		case MONTH.JULY:
			return JULY_HOLIDAYS[day] ?? SEASONAL_THEME.SUMMER;

		case MONTH.AUGUST:
		case MONTH.SEPTEMBER:
			return SEASONAL_THEME.SUMMER;

		case MONTH.OCTOBER:
			return day === 31 ? SEASONAL_THEME.HALLOWEEN : SEASONAL_THEME.FALL;

		case MONTH.NOVEMBER:
			return day === 11 ? SEASONAL_THEME.REMEMBERANCE_DAY : SEASONAL_THEME.FALL;

		case MONTH.DECEMBER:
			return day === 31 ? SEASONAL_THEME.NEW_YEARS : SEASONAL_THEME.CHRISTMAS;

		default:
			return SEASONAL_THEME.SPRING;
	}
};

export default getEasterDate;
