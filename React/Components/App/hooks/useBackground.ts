import { useState, useEffect, useRef, useMemo } from "react";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { BackgroundTheme } from "src/Types/Enums";
import { CachedBackground } from "src/Types/Interfaces";
import getBackground from "React/Utils/getBackground";
import BeautitabPlugin from "main";

const preloadImage = (url: string): Promise<void> => {
	return new Promise((resolve) => {
		let settled = false;
		const finalize = () => {
			if (settled) return;
			settled = true;
			resolve();
		};
		const img = new Image();
		img.onload = finalize;
		img.onerror = finalize;
		img.src = url;
		img.decode?.().then(finalize).catch(finalize);
	});
};

interface UseBackgroundResult {
	currentBg: CachedBackground | null;
	incomingBg: CachedBackground | null;
	isBackgroundVisible: boolean;
	isCrossfading: boolean;
	backgroundStyle: Record<string, string> & React.CSSProperties;
}

export const useBackground = (
	settings: BeautitabPluginSettings,
	plugin: BeautitabPlugin
): UseBackgroundResult => {
	const isCachedBackgroundUsable = useMemo(() => {
		if (settings.debugRefreshBackgroundOnOpen) return false;
		const cached = settings.cachedBackground;
		if (!cached?.url) return false;
		if (
			settings.backgroundTheme === BackgroundTheme.TRANSPARENT ||
			settings.backgroundTheme === BackgroundTheme.TRANSPARENT_WITH_SHADOWS
		) {
			return false;
		}
		if (cached.theme !== settings.backgroundTheme) return false;
		if (settings.backgroundTheme === BackgroundTheme.CUSTOM) {
			const trimmed = settings.customBackground?.trim();
			return !!trimmed && trimmed === cached.url;
		}
		if (settings.backgroundTheme === BackgroundTheme.LOCAL) {
			return settings.localBackgrounds?.includes(cached.url) ?? false;
		}
		return true;
	}, [
		settings.debugRefreshBackgroundOnOpen,
		settings.cachedBackground,
		settings.backgroundTheme,
		settings.customBackground,
		settings.localBackgrounds,
	]);

	const [currentBg, setCurrentBg] = useState<CachedBackground | null>(
		isCachedBackgroundUsable ? (settings.cachedBackground ?? null) : null
	);
	const [incomingBg, setIncomingBg] = useState<CachedBackground | null>(null);
	const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);
	const [isCrossfading, setIsCrossfading] = useState(false);
	const hasShownBackgroundRef = useRef(false);
	const currentBgRef = useRef<CachedBackground | null>(null);

	useEffect(() => {
		currentBgRef.current = currentBg;
	}, [currentBg]);

	// Sync cached background
	useEffect(() => {
		if (!isCachedBackgroundUsable) return;
		if (currentBgRef.current?.url) return;
		setCurrentBg(settings.cachedBackground ?? null);
	}, [isCachedBackgroundUsable, settings.cachedBackground]);

	// Handle background loading and crossfade
	useEffect(() => {
		// If cached background is usable, do not even attempt to fetch a new one.
		// This prevents an API request on every tab open.
		if (isCachedBackgroundUsable && settings.cachedBackground?.url) return;

		let cancelled = false;
		let timeout: number | undefined;

		const run = async () => {
			const result = await getBackground(
				settings.backgroundTheme,
				settings.customBackground,
				settings.localBackgrounds,
				settings.apiKey,
				settings.backgroundCache,
				settings.debugRefreshBackgroundOnOpen
			);
			if (cancelled) return;
			const bg = result.background;
			if (!bg?.url) return;

			if (
				isCachedBackgroundUsable &&
				settings.cachedBackground?.url &&
				currentBgRef.current?.url === settings.cachedBackground.url
			) {
				return;
			}

			await preloadImage(bg.url);
			if (cancelled) return;

			const prev = currentBgRef.current;
			if (!prev?.url) {
				setCurrentBg(bg);
				return;
			}

			if (prev.url === bg.url) {
				return;
			}

			setIncomingBg(bg);
			requestAnimationFrame(() => {
				if (!cancelled) setIsCrossfading(true);
			});
			timeout = window.setTimeout(() => {
				if (cancelled) return;
				setCurrentBg(bg);
				setIncomingBg(null);
				setIsCrossfading(false);
			}, 500);
		};

		void run();
		return () => {
			cancelled = true;
			if (timeout) window.clearTimeout(timeout);
		};
	}, [
		isCachedBackgroundUsable,
		settings.cachedBackground?.url,
		settings.backgroundTheme,
		settings.customBackground,
		settings.localBackgrounds,
		settings.apiKey,
		settings.backgroundCache,
		settings.debugRefreshBackgroundOnOpen,
	]);

	// Handle visibility state
	useEffect(() => {
		if (!currentBg?.url && !incomingBg?.url) return;
		if (!hasShownBackgroundRef.current) {
			hasShownBackgroundRef.current = true;
			requestAnimationFrame(() => setIsBackgroundVisible(true));
			return;
		}
		setIsBackgroundVisible(true);
	}, [currentBg?.url, incomingBg?.url]);

	// Save cached background
	useEffect(() => {
		if (settings.debugRefreshBackgroundOnOpen) return;
		if (!currentBg) return;
		if (
			currentBg.url === settings.cachedBackground?.url &&
			currentBg.theme === settings.cachedBackground?.theme
		) {
			return;
		}
		plugin.settings.cachedBackground = currentBg;
		void plugin.saveSettings();
	}, [currentBg, settings.cachedBackground, settings.debugRefreshBackgroundOnOpen, plugin]);

	const backgroundStyle = useMemo<Record<string, string> & React.CSSProperties>(() => {
		const style: Record<string, string> & React.CSSProperties = {};
		if (currentBg?.url) {
			style["--beautitab-bg-url-current"] = `url("${currentBg.url}")`;
		}
		if (incomingBg?.url) {
			style["--beautitab-bg-url-next"] = `url("${incomingBg.url}")`;
		}
		return style;
	}, [currentBg?.url, incomingBg?.url]);

	return {
		currentBg,
		incomingBg,
		isBackgroundVisible,
		isCrossfading,
		backgroundStyle,
	};
};
