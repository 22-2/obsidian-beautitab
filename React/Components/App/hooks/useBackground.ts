import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { BackgroundTheme } from "src/Types/Enums";
import { CachedBackground } from "src/Types/Interfaces";
import getBackground from "React/Utils/getBackground";
import BeautitabPlugin from "main";
import { LocalImageCache } from "src/Utils/LocalImageCache";

const CROSSFADE_DURATION = 500;

// ========== Helper Functions ==========

const resolveUrl = (url: string, plugin: BeautitabPlugin): string => {
    if (!url) return "";
    if (url.startsWith("http") || url.startsWith("data:")) return url;
    return plugin.app.vault.adapter.getResourcePath(url);
};

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

const isSameDate = (date1: Date, date2: Date): boolean => {
    return (
        date1.getDate() === date2.getDate() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getFullYear() === date2.getFullYear()
    );
};

// ========== Background Validation ==========

const isTransparentTheme = (theme: BackgroundTheme): boolean => {
    return (
        theme === BackgroundTheme.TRANSPARENT ||
        theme === BackgroundTheme.TRANSPARENT_WITH_SHADOWS
    );
};

const isBackgroundFromToday = (bg: CachedBackground): boolean => {
    if (!bg.date) return false;
    const cachedDate = new Date(bg.date);
    const today = new Date();
    return isSameDate(cachedDate, today);
};

const validateCachedBackground = (
    cached: CachedBackground | undefined | null,
    settings: BeautitabPluginSettings
): boolean => {
    if (!cached?.url) return false;
    if (isTransparentTheme(settings.backgroundTheme)) return false;
    if (cached.theme !== settings.backgroundTheme) return false;

    if (settings.backgroundTheme === BackgroundTheme.CUSTOM) {
        const trimmed = settings.customBackground?.trim();
        return !!trimmed && trimmed === cached.url;
    }

    if (!isBackgroundFromToday(cached)) return false;

    if (settings.backgroundTheme === BackgroundTheme.LOCAL) {
        return settings.localBackgrounds?.includes(cached.url) ?? false;
    }

    return true;
};

// ========== Fetch Background ==========

interface FetchBackgroundParams {
    settings: BeautitabPluginSettings;
    forceRefresh?: boolean;
    plugin: BeautitabPlugin;
}

const fetchNewBackground = async ({
    settings,
    forceRefresh = false,
    plugin,
}: FetchBackgroundParams): Promise<CachedBackground | null> => {
    // Fallback to API
    const result = await getBackground(
        settings.backgroundTheme,
        settings.customBackground,
        settings.localBackgrounds,
        settings.apiKey,
        settings.backgroundCache,
        settings.debugRefreshBackgroundOnOpen || forceRefresh
    );

    if (result.background?.url && !result.background.url.startsWith("data:")) {
        const cache = new LocalImageCache(plugin);
        const localPath = await cache.saveImage(result.background.url);
        if (localPath) {
            result.background.url = localPath;
        }
    }

    return result.background;
};

// ========== Hook Interface ==========

interface UseBackgroundResult {
    currentBg: CachedBackground | null;
    incomingBg: CachedBackground | null;
    isBackgroundVisible: boolean;
    isCrossfading: boolean;
    backgroundStyle: Record<string, string> & React.CSSProperties;
}

// ========== Main Hook ==========

export const useBackground = (
    settings: BeautitabPluginSettings,
    plugin: BeautitabPlugin
): UseBackgroundResult => {
    const queryClient = useQueryClient();

    // Memoized validation
    const isCachedUsable = useMemo(
        () =>
            !settings.debugRefreshBackgroundOnOpen &&
            validateCachedBackground(settings.cachedBackground, settings),
        [
            settings.debugRefreshBackgroundOnOpen,
            settings.cachedBackground,
            settings.backgroundTheme,
            settings.customBackground,
            settings.localBackgrounds,
        ]
    );

    // 1. Main background query
    const { data: fetchedBg, isSuccess } = useQuery({
        queryKey: ["background", settings.backgroundTheme, settings.customBackground, settings.localBackgrounds],
        queryFn: () => fetchNewBackground({ settings, plugin, forceRefresh: settings.debugRefreshBackgroundOnOpen }),
        staleTime: 1000 * 60 * 60, // 1 hour
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        enabled: !isCachedUsable,
    });

    // State
    const [currentBg, setCurrentBg] = useState<CachedBackground | null>(
        isCachedUsable ? settings.cachedBackground ?? null : null
    );
    const [incomingBg, setIncomingBg] = useState<CachedBackground | null>(null);
    const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);
    const [isCrossfading, setIsCrossfading] = useState(false);

    // Refs
    const currentBgRef = useRef<CachedBackground | null>(null);
    const hasShownBackgroundRef = useRef(false);

    useEffect(() => {
        currentBgRef.current = currentBg;
    }, [currentBg]);

    // 2. Prefetch next background
    useEffect(() => {
        if (isSuccess && fetchedBg) {
            // Prefetch for next time
            queryClient.prefetchQuery({
                queryKey: ["background", settings.backgroundTheme, "next"],
                queryFn: () => fetchNewBackground({ settings, plugin, forceRefresh: true }),
                staleTime: 1000 * 60 * 5,
            });
        }
    }, [isSuccess, fetchedBg, queryClient, settings, plugin]);

    // 3. Handle background updates and crossfade
    useEffect(() => {
        const bg = isCachedUsable ? settings.cachedBackground : fetchedBg;
        if (!bg?.url) return;

        let cancelled = false;
        let timeout: number | undefined;

        const updateBackground = async () => {
            const resolvedUrl = resolveUrl(bg.url, plugin);
            await preloadImage(resolvedUrl);
            if (cancelled) return;

            const prev = currentBgRef.current;

            // No previous background - set immediately
            if (!prev?.url) {
                setCurrentBg(bg);
                return;
            }

            // Same URL - skip
            if (prev.url === bg.url) return;

            // Crossfade to new background
            setIncomingBg(bg);
            requestAnimationFrame(() => {
                if (!cancelled) setIsCrossfading(true);
            });

            timeout = window.setTimeout(() => {
                if (cancelled) return;
                setCurrentBg(bg);
                setIncomingBg(null);
                setIsCrossfading(false);
            }, CROSSFADE_DURATION);
        };

        void updateBackground();

        return () => {
            cancelled = true;
            if (timeout) window.clearTimeout(timeout);
        };
    }, [isCachedUsable, settings.cachedBackground, fetchedBg, plugin]);

    // Handle visibility
    useEffect(() => {
        if (!currentBg?.url && !incomingBg?.url) return;

        if (!hasShownBackgroundRef.current) {
            hasShownBackgroundRef.current = true;
            requestAnimationFrame(() => setIsBackgroundVisible(true));
            return;
        }

        setIsBackgroundVisible(true);
    }, [currentBg?.url, incomingBg?.url]);

    // Save current background
    useEffect(() => {
        if (settings.debugRefreshBackgroundOnOpen || !currentBg) return;

        if (
            currentBg.url === settings.cachedBackground?.url &&
            currentBg.theme === settings.cachedBackground?.theme
        ) {
            return;
        }

        plugin.settings.cachedBackground = currentBg;
        void plugin.saveSettings();
    }, [
        currentBg,
        settings.cachedBackground,
        settings.debugRefreshBackgroundOnOpen,
        plugin,
    ]);

    // Generate CSS variables
    const backgroundStyle = useMemo<Record<string, string> & React.CSSProperties>(() => {
        const style: Record<string, string> & React.CSSProperties = {};
        if (currentBg?.url) {
            style["--beautitab-bg-url-current"] = `url("${resolveUrl(currentBg.url, plugin)}")`;
        }
        if (incomingBg?.url) {
            style["--beautitab-bg-url-next"] = `url("${resolveUrl(incomingBg.url, plugin)}")`;
        }
        return style;
    }, [currentBg?.url, incomingBg?.url, plugin]);

    return {
        currentBg,
        incomingBg,
        isBackgroundVisible,
        isCrossfading,
        backgroundStyle,
    };
};
