import { addDays, setDate, setMonth, getDay } from "date-fns";

/**
 * An incredibly silly calculation to figure out when Easter is. I can't believe this is a thing.
 * @param year
 */
const getEasterDate = (year: number) => {
	// Step 1: Calculate the Golden Number (GN)
	const GN = (year % 19) + 1;

	// Step 2: Calculate the Century (C)
	const C = Math.floor(year / 100) + 1;

	// Step 3: Calculate the X value
	const X = Math.floor((3 * C) / 4) - 12;

	// Step 4: Calculate the Z value
	const Z = Math.floor((8 * C + 5) / 25) - 5;

	// Step 5: Calculate the D value
	const D = (5 * GN + X) % 30;

	// Step 6: Calculate the Epact (E)
	let E = (11 * D + Z) % 30;

	// Step 7: Adjust the Epact if necessary
	if (
		(E === 24 && ((D === 29 && GN > 11) || (D === 28 && GN > 12))) ||
		(E === 25 && D === 28)
	) {
		E--;
	}

	// Step 8: Calculate the date of the March equinox (March 21)
	let marchEquinox = new Date(year, 0, 1);
	marchEquinox = setMonth(marchEquinox, 2); // March
	marchEquinox = setDate(marchEquinox, 21);

	// Step 9: Calculate the Full Moon
	const fullMoon = addDays(marchEquinox, E);

	// Step 10: Calculate the Sunday following the Full Moon (Easter)
	const daysToSunday = (7 - getDay(fullMoon)) % 7;
	const easterDate = addDays(fullMoon, daysToSunday);

	return easterDate;
};

export default getEasterDate;
