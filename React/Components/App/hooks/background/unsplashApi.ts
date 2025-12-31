// ============================================================================
// Unsplash API Integration
// ============================================================================

import { createApi } from "unsplash-js";
import log from "loglevel";

import {
	BackgroundTheme,
	CachedBackgroundItem,
} from "./types";
import { fetchPolyfillSafe } from "src/Utils/fetchPolyfillSafe";

const logger = log.getLogger("Beautytab:UnsplashApi");

// ============================================================================
// URL Helpers
// ============================================================================

/**
 * Normalizes Unsplash URLs to lower quality for blur-friendly backgrounds
 */
export const maybeLowerQualityUnsplashUrl = (url: string): string => {
	if (!url.includes("images.unsplash.com")) return url;

	try {
		const u = new URL(url);
		u.searchParams.set("auto", "format");
		u.searchParams.set("fit", "crop");
		u.searchParams.set("w", "1600");
		u.searchParams.set("q", "20");
		return u.toString();
	} catch {
		const separator = url.includes("?") ? "&" : "?";
		return `${url}${separator}auto=format&fit=crop&w=1600&q=20`;
	}
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches multiple random photos from Unsplash API.
 * Photos in the same request are guaranteed to be unique.
 */
export const fetchMultipleFromUnsplash = async (
	apiKey: string,
	query: string,
	theme: BackgroundTheme,
	count: number = 2
): Promise<CachedBackgroundItem[]> => {
	try {
		const response = await createApi({
			accessKey: apiKey,
			fetch: fetchPolyfillSafe as any,
		})
			.photos.getRandom({
				query,
				count,
			})
			.then((result) => result.response);

		const items = response
			? response instanceof Array
				? response
				: [response]
			: [];

		return items.map((photo) => ({
			url: maybeLowerQualityUnsplashUrl(photo.urls.raw),
			date: new Date().toISOString(),
			theme,
		}));
	} catch (e) {
		logger.error("Unsplash API error:", e);
		return [];
	}
};

/**
 * Fetches a single random photo from Unsplash API
 */
export const fetchFromUnsplashApi = async (
	apiKey: string,
	query: string,
	theme: BackgroundTheme,
	now: Date
): Promise<CachedBackgroundItem | null> => {
	const items = await fetchMultipleFromUnsplash(apiKey, query, theme, 1);
	if (items.length === 0) return null;
	return { ...items[0], date: now.toISOString() };
};
