import { useMemo } from "react";

/**
 * Hook to track effective time for background switching
 * 
 * The effective time is fixed to the mount time. This ensures that once a tab
 * is opened, its background stays consistent and won't change due to hour updates.
 * New tabs will use the current time when they mount, getting the appropriate
 * background for that time.
 * 
 * This design prevents the issue where multiple tabs would each fetch different
 * backgrounds when the hour changes.
 */
export const useEffectiveTime = () => {
	// Use mount time as the fixed effective time for this tab instance
	const mountTime = useMemo(() => new Date(), []);

	return {
		effectiveTime: mountTime,
		currentHour: mountTime.getHours(),
		currentDay: mountTime.toDateString(),
	};
};

