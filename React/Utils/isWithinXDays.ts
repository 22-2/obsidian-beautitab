import {
	differenceInMilliseconds,
	isAfter,
	isBefore,
	startOfDay,
	getHours,
} from "date-fns";

/**
 * Returns true if dateA within X days of dateB (dateB minus X)
 * @param dateA
 * @param days
 * @param dateB
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
 * Returns true if dateA within X days of dateB (dateB plus X)
 * @param dateA
 * @param days
 * @param dateB
 * @returns
 */
export const isWithinDaysAfter = (
	dateA: Date,
	days: number,
	dateB: Date
): boolean => {
	const daysInMilliseconds = days * 24 * 60 * 60 * 1000;
	return isAfter(dateA, dateB) && differenceInMilliseconds(dateA, dateB) <= daysInMilliseconds;
};

/**
 * Returns true if the hours of dateA are within the hours of dateB
 * Aka dateA is *before* dateB and their hours of difference is more than 1 hours
 * @param dateA {Date} - The "cached" date
 * @param hours {number} - The number of hours to compare
 * @param dateB {Date} - The "current" date
 * @returns {boolean}
 */
export const isWithinHoursAfter = (
	dateA: Date,
	hours: number,
	dateB: Date
): boolean => {
	const dayA = startOfDay(dateA);
	const dayB = startOfDay(dateB);

	if (isBefore(dayA, dayB)) return true;

	const hoursA = getHours(dateA);
	const hoursB = getHours(dateB);
	return hoursA < hoursB && hoursB - hoursA >= hours;
};
