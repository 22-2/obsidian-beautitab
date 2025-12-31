import { format } from "date-fns";
import { TIME_FORMAT } from "React/Components/App/hooks/background/types";

/**
 * Returns the current time in a 00:00 format, either 12-hour or 24-hour
 */
const getTime = (timeFormat: TIME_FORMAT) => {
	const today = new Date();

	if (timeFormat === TIME_FORMAT.TWELVE_HOUR) {
		return format(today, "h:mm");
	} else {
		return format(today, "HH:mm");
	}
};

export default getTime;
