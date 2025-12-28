import { BeautitabPluginSettings } from "src/Settings/Settings";

export type BackgroundQueryKey = readonly [
	"background",
	BeautitabPluginSettings["backgroundTheme"],
	string,
	number,
	string,
	number,
];

/**
 * Shared query key for backgrounds.
 *
 * Important: keep this stable across UI (useQuery) and background prefetch (QueryClient)
 * so in-flight dedupe + cache reuse works reliably.
 */
export const buildBackgroundQueryKey = (
	settings: BeautitabPluginSettings,
	now: Date
): BackgroundQueryKey => {
	return [
		"background",
		settings.backgroundTheme,
		(settings.customBackground ?? "").trim(),
		settings.localBackgrounds?.length ?? 0,
		now.toDateString(),
		now.getHours(),
	] as const;
};
