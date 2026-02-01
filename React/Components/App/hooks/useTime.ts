import { useState, useEffect } from "react";
import getTime from "React/Utils/getTime";
import { TIME_FORMAT } from "React/Components/App/hooks/background/types";
import { setInterval, clearInterval } from "worker-timers";

export const useTime = (
	timeFormat: TIME_FORMAT,
	showSeconds: boolean
): string => {
	const [time, setTime] = useState(getTime(timeFormat, showSeconds));

	useEffect(() => {
		const timer = setInterval(() => {
			setTime(getTime(timeFormat, showSeconds));
		}, 1000);

		return () => {
			clearInterval(timer);
		};
	}, [timeFormat, showSeconds]);

	return time;
};
