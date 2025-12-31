import React from "react";
import { CachedBackground } from "src/Types/Interfaces";

/**
 * Result returned by useBackground hook
 */
export interface UseBackgroundResult {
	/** Currently displayed background */
	currentBg: CachedBackground | null;
	/** Background being transitioned to (during crossfade) */
	incomingBg: CachedBackground | null;
	/** Whether the background is visible (after initial fade-in) */
	isBackgroundVisible: boolean;
	/** Whether a crossfade transition is in progress */
	isCrossfading: boolean;
	/** CSS custom properties for background URLs */
	backgroundStyle: Record<string, string> & React.CSSProperties;
}

/**
 * State for crossfade animation
 */
export interface CrossfadeState {
	currentBg: CachedBackground | null;
	incomingBg: CachedBackground | null;
	isBackgroundVisible: boolean;
	isCrossfading: boolean;
}
