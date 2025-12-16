import { useState, useEffect } from "react";
import getTime from "React/Utils/getTime";
import { TIME_FORMAT } from "src/Types/Enums";

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
