import type { InternalPluginNameType } from "obsidian-typings";
import { Notice, Platform, Plugin } from "obsidian";
import { ReactView, BEAUTITAB_REACT_VIEW } from "./Views/ReactView";
import { setSettings } from "src/Utils/settingsStore";
import { BackgroundTheme } from "React/Components/App/hooks/background/types";
import { QueryClient } from "@tanstack/react-query";
import { around } from "monkey-around";
import {
	BeautitabPluginSettingTab,
	BeautitabPluginSettings,
	DEFAULT_SETTINGS,
} from "src/Settings/Settings";
import logger from "src/Utils/logger";
import { LocalImageCache } from "src/Utils/LocalImageCache";
import { clearInterval, setInterval } from "worker-timers";
import { fetchMultipleFromUnsplash } from "React/Components/App/hooks/background/unsplashApi";
import { getSeasonalTag } from "React/Components/App/hooks/background/seasonalTheme";
import { addHours, getHours } from "date-fns";

const TEN_MINUTES = 10 * 60 * 1000;

/**
 * 開発モード用の設定
 */
class DevModeManager {
	private static readonly HOT_RELOAD_URL = "http://127.0.0.1:8000/esbuild";

	static initialize() {
		if (process.env.NODE_ENV !== "development") return;

		this.setupHotReload();
	}

	private static setupHotReload() {
		new EventSource(this.HOT_RELOAD_URL).addEventListener(
			"change",
			() => location.reload()
		);
	}

	static configureMobileEmulation(app: any) {
		if (process.env.NODE_ENV !== "development") return;

		const shouldEmulateMobile = process.env.EMULATE_MOBILE && !Platform.isMobile;
		const shouldDisableEmulation = !process.env.EMULATE_MOBILE && Platform.isMobile;

		if (shouldEmulateMobile) {
			app.emulateMobile(true);
		} else if (shouldDisableEmulation) {
			app.emulateMobile(false);
		}
	}
}


/**
 * バージョンチェック機能
 */
// class VersionChecker {
// 	private static readonly REPO_URL = "https://raw.githubusercontent.com/andrewmcgivery/obsidian-beautitab";

// 	static async check() {
// 		const localVersion = process.env.PLUGIN_VERSION;
// 		const [stableVersion, betaVersion] = await Promise.all([
// 			this.fetchVersion("main"),
// 			this.fetchVersion("beta"),
// 		]);

// 		this.notifyIfUpdateAvailable(localVersion, stableVersion, betaVersion);
// 	}

// 	private static async fetchVersion(branch: string): Promise<string | null> {
// 		try {
// 			const response = await requestUrl(`${this.REPO_URL}/${branch}/package.json`);
// 			if (response.status === 200) {
// 				return (await response.json).version;
// 			}
// 		} catch (error) {
// 			console.error(`Failed to fetch ${branch} version:`, error);
// 		}
// 		return null;
// 	}

// 	private static notifyIfUpdateAvailable(
// 		localVersion: string | undefined,
// 		stableVersion: string | null,
// 		betaVersion: string | null
// 	) {
// 		const isBeta = localVersion?.includes("beta");

// 		if (isBeta && localVersion !== betaVersion) {
// 			this.showUpdateNotice("beta");
// 		} else if (!isBeta && localVersion !== stableVersion) {
// 			this.showUpdateNotice("stable");
// 		}
// 	}

// 	private static showUpdateNotice(type: "stable" | "beta") {
// 		const message = type === "beta"
// 			? "There is a beta update available for the Beautitab plugin."
// 			: "There is an update available for the Beautitab plugin.";

// 		new Notice(
// 			`${message} Please update to the latest version to get the latest features!`,
// 			0
// 		);
// 	}
// }

/**
 * メインプラグインクラス
 */
export default class BeautitabPlugin extends Plugin {
	settings: BeautitabPluginSettings;
	queryClient: QueryClient;
	imageCache!: LocalImageCache;
	private backgroundCheckTimer: number | null = null;

	async onload() {
		logger.info("Beautitab: Plugin Loading... VERSION CHECK " + Date.now());
		this.app.workspace.onLayoutReady(async () => {
			this.setupView();
			this.imageCache = new LocalImageCache(this);
			this.queryClient = new QueryClient();
			await this.initializeSettings();
			this.applyLogLevel();
			DevModeManager.initialize();
			this.addSettingTab(new BeautitabPluginSettingTab(this.app, this));
			DevModeManager.configureMobileEmulation(this.app);
			this.patchNewTab();
			this.startBackgroundCheck();
		});
	}

	onunload(): void {
		this.stopBackgroundCheck();
		this.imageCache?.prune();
	}

	/**
	 * Start periodic wallpaper prefetch (every 10 minutes)
	 * Fetches wallpapers for current hour and next hour
	 */
	private startBackgroundCheck() {
		// Stop existing if any
		this.stopBackgroundCheck();

		// Initial prune (only at startup)
		this.imageCache.prune();

		// Initial fetch
		this.prefetchWallpapers();

		// Schedule periodic fetch
		this.backgroundCheckTimer = setInterval(() => {
			this.prefetchWallpapers();
		}, TEN_MINUTES);
	}

	/**
	 * Prefetch wallpapers for current hour and next hour
	 */
	async prefetchWallpapers() {
		const { backgroundTheme, apiKey } = this.settings;

		// Skip for themes that don't need prefetching
		if (
			backgroundTheme === BackgroundTheme.CUSTOM ||
			backgroundTheme === BackgroundTheme.LOCAL ||
			backgroundTheme === BackgroundTheme.TRANSPARENT ||
			backgroundTheme === BackgroundTheme.TRANSPARENT_WITH_SHADOWS
		) {
			return;
		}

		// Skip if no API key
		if (!apiKey) {
			logger.debug("Skipping prefetch: no API key");
			return;
		}

		const now = new Date();
		const nextHour = addHours(now, 1);

		// Check what we already have cached
		const currentCached = await this.imageCache.getForHour(backgroundTheme, now);
		const nextCached = await this.imageCache.getForHour(backgroundTheme, nextHour);

		// Both cached, nothing to do
		if (currentCached && nextCached) {
			logger.debug("Both hours already cached");
			return;
		}

		// Determine how many to fetch
		const needCount = (currentCached ? 0 : 1) + (nextCached ? 0 : 1);
		if (needCount === 0) return;

		logger.debug("Prefetching wallpapers", {
			currentHour: getHours(now),
			nextHour: getHours(nextHour),
			needCount,
		});

		try {
			// Fetch required number of unique images in one request
			const query = backgroundTheme === BackgroundTheme.SEASONS_AND_HOLIDAYS
				? getSeasonalTag(now)
				: backgroundTheme;

			const images = await fetchMultipleFromUnsplash(
				apiKey,
				query,
				backgroundTheme,
				needCount
			);

			if (images.length === 0) {
				logger.debug("No images from Unsplash");
				return;
			}

			let imageIndex = 0;

			// Cache for current hour if needed
			if (!currentCached && images[imageIndex]) {
				await this.imageCache.cache(images[imageIndex].url, backgroundTheme, now);
				imageIndex++;
			}

			// Cache for next hour if needed (guaranteed different image)
			if (!nextCached && images[imageIndex]) {
				await this.imageCache.cache(images[imageIndex].url, backgroundTheme, nextHour);
			}

			logger.debug("Wallpaper prefetch complete");
		} catch (e) {
			logger.error("Prefetch error:", e);
		}
	}

	private stopBackgroundCheck() {
		if (this.backgroundCheckTimer !== null) {
			clearInterval(this.backgroundCheckTimer);
			this.backgroundCheckTimer = null;
		}
	}

	patchNewTab() {
		this.register(around(
			this.app.commands.commands["workspace:new-tab"],
			{
				checkCallback: (next: any) => {
					return (checking: boolean) => {
							if (!checking) {
								return this.app.workspace.getLeaf(true).setViewState({
									type: BEAUTITAB_REACT_VIEW,
									active: true,
								});
							}
						return next ? next(checking) : true;
					};
				},
			}
		));
	}

	private async initializeSettings() {
		await this.loadSettings();
		setSettings(this.settings);
	}

	private setupView() {
		this.registerView(
			BEAUTITAB_REACT_VIEW,
			(leaf) => new ReactView(this.app, leaf, this)
		);
	}

	async loadSettings() {
		const data = (await this.loadData()) || {};
		const merged = Object.assign({}, DEFAULT_SETTINGS, data);
		this.settings = merged;
	}

	async saveSettings() {
		await this.saveData(this.settings);
		setSettings(this.settings);
		this.applyLogLevel();
	}

	applyLogLevel() {
		if (this.settings.enableLogging) {
			logger.setLevel("info");
		} else {
			logger.setLevel("silent");
		}
	}

	openSwitcherCommand(command: string): void {
		const pluginID = command.split(":")[0];

		if (this.isPluginEnabled(pluginID)) {
			this.app.commands.executeCommandById(command);
		} else {
			this.notifyPluginNotEnabled(pluginID);
		}
	}

	private isPluginEnabled(pluginID: string): boolean {
		const isCommunityPlugin = this.app.plugins.enabledPlugins.has(pluginID);
		const isInternalPlugin = this.app.internalPlugins.getEnabledPluginById(
			pluginID as InternalPluginNameType
		);

		return isCommunityPlugin || !!isInternalPlugin;
	}

	private notifyPluginNotEnabled(pluginID: string) {
		new Notice(
			`Plugin ${pluginID} is not enabled. Please enable it in the settings.`
		);
	}
}
