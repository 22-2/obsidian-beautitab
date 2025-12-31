import { useState, useEffect } from "react";
import getTime from "React/Utils/getTime";
import { TIME_FORMAT } from "React/Components/App/hooks/background/types";
import { setInterval, clearInterval } from "worker-timers";

export const useTime = (timeFormat: TIME_FORMAT): string => {
	const [time, setTime] = useState(getTime(timeFormat));

	useEffect(() => {
		const timer = setInterval(() => {
			setTime(getTime(timeFormat));
		}, 1000);

		return () => {
			clearInterval(timer);
		};
	}, [timeFormat]);

	return time;
};
