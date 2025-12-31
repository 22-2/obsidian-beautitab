import React from "react";
import { CachedBackground } from "src/Types/Interfaces";

/**
 * Result returned by useBackground hook
 */
export interface UseBackgroundResult {
	/** Currently displayed background */
	currentBg: CachedBackground | null;
	/** Whether the background is visible (after initial fade-in) */
	isBackgroundVisible: boolean;
	/** CSS custom properties for background URL */
	backgroundStyle: Record<string, string> & React.CSSProperties;
}
