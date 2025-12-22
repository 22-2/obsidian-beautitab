import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import { BackgroundTheme } from "src/Types/Enums";
import { CachedBackground } from "src/Types/Interfaces";
import getBackground from "React/Utils/getBackground";
import BeautitabPlugin from "main";
import { LocalImageCache } from "src/Utils/LocalImageCache";

const QUEUE_KEY = "beautitab-bg-queue";
const MIN_QUEUE_SIZE = 3;
const CROSSFADE_DURATION = 500;
const REPLENISH_DELAY = 2000;

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

// ========== Queue Management ==========

const readQueue = (): CachedBackground[] => {
    try {
        const data = localStorage.getItem(QUEUE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error("Error reading background queue", e);
        return [];
    }
};

const writeQueue = (queue: CachedBackground[]): void => {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
        console.error("Error writing background queue", e);
    }
};

const dequeueBackground = (theme: BackgroundTheme): CachedBackground | null => {
    const queue = readQueue();
    const index = queue.findIndex(item => item.theme === theme);
    
    if (index === -1) return null;
    
    const [bg] = queue.splice(index, 1);
    writeQueue(queue);
    return bg;
};

const enqueueBackground = (bg: CachedBackground): void => {
    const queue = readQueue();
    if (!queue.some(item => item.url === bg.url)) {
        queue.push(bg);
        writeQueue(queue);
    }
};

const countQueueForTheme = (theme: BackgroundTheme): number => {
    const queue = readQueue();
    return queue.filter(item => item.theme === theme).length;
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
    // Try queue first (unless debugging or forcing refresh)
    if (!forceRefresh && !settings.debugRefreshBackgroundOnOpen) {
        const queued = dequeueBackground(settings.backgroundTheme);
        if (queued?.url) return queued;
    }

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
    const isReplenishingRef = useRef(false);

    useEffect(() => {
        currentBgRef.current = currentBg;
    }, [currentBg]);

    // Sync cached background if usable
    useEffect(() => {
        if (!isCachedUsable || currentBgRef.current?.url) return;
        setCurrentBg(settings.cachedBackground ?? null);
    }, [isCachedUsable, settings.cachedBackground]);

    // Load background with crossfade
    useEffect(() => {
        if (isCachedUsable && settings.cachedBackground?.url) return;

        let cancelled = false;
        let timeout: number | undefined;

        const loadBackground = async () => {
            const bg = await fetchNewBackground({ settings, plugin });
            if (cancelled || !bg?.url) return;

            // Skip if cached background became usable
            if (
                isCachedUsable &&
                settings.cachedBackground?.url &&
                currentBgRef.current?.url === settings.cachedBackground.url
            ) {
                return;
            }

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

        void loadBackground();

        return () => {
            cancelled = true;
            if (timeout) window.clearTimeout(timeout);
        };
    }, [
        isCachedUsable,
        settings.cachedBackground?.url,
        settings.backgroundTheme,
        settings.customBackground,
        settings.localBackgrounds,
        settings.apiKey,
        settings.backgroundCache,
        settings.debugRefreshBackgroundOnOpen,
        plugin,
    ]);

    // Replenish queue in background
    useEffect(() => {
        if (settings.debugRefreshBackgroundOnOpen) return;

        const replenish = async () => {
            if (isReplenishingRef.current) return;

            const currentCount = countQueueForTheme(settings.backgroundTheme);
            if (currentCount >= MIN_QUEUE_SIZE) return;

            isReplenishingRef.current = true;

            try {
                const bg = await fetchNewBackground({ 
                    settings, 
                    forceRefresh: true,
                    plugin 
                });

                if (bg?.url) {
                    // Preload into browser cache
                    const resolvedUrl = resolveUrl(bg.url, plugin);
                    const img = new Image();
                    img.src = resolvedUrl;
                    
                    // Add to queue
                    enqueueBackground(bg);
                }
            } catch (e) {
                console.error("Failed to replenish background queue", e);
            } finally {
                isReplenishingRef.current = false;
            }
        };

        const timer = setTimeout(replenish, REPLENISH_DELAY);
        return () => clearTimeout(timer);
    }, [
        settings.backgroundTheme,
        settings.customBackground,
        settings.localBackgrounds,
        settings.apiKey,
        settings.debugRefreshBackgroundOnOpen,
        currentBg,
        plugin,
    ]);

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
