import type { InternalPluginName, InternalPluginNameType } from "obsidian-typings";
import { Notice, Platform, Plugin, requestUrl } from "obsidian";
import { ReactView, BEAUTITAB_REACT_VIEW } from "./Views/ReactView";
import { setSettings } from "src/Utils/settingsStore";
import { normalizeBackgroundCache, hasFreshBackground } from "src/Utils/backgroundCache";
import { fetchNewBackground } from "src/Utils/backgroundFetcher";
import { BackgroundTheme } from "src/Types/Enums";
import { buildBackgroundQueryKey } from "src/Utils/backgroundQuery";
// @ts-expect-error
import BackgroundWorker from "src/Utils/background.worker";
import { QueryClient } from "@tanstack/react-query";
import { around } from "monkey-around";
import {
	BeautitabPluginSettingTab,
	BeautitabPluginSettings,
	DEFAULT_SETTINGS,
} from "src/Settings/Settings";
import { NEW_TAB_BEHAVIOR } from "src/Types/Enums";
import logger from "src/Utils/logger";

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
 * バックグラウンド画像のプリフェッチを管理
 */
class BackgroundPrefetchManager {
	private static readonly MIN_FETCH_INTERVAL = 1000 * 60 * 3; // 3分

	private worker: Worker;
	private isFetching = false;
	private lastFetchAttempt = 0;

	constructor(
		private settings: BeautitabPluginSettings,
		private plugin: BeautitabPlugin
	) {}

	start() {
		this.worker = new BackgroundWorker();
		this.worker.onmessage = (e) => {
			if (e.data.type === "check") {
				this.checkAndPrefetch();
			}
		};
		this.worker.postMessage({ type: "start" });
	}

	stop() {
		if (this.worker) {
			this.worker.postMessage({ type: "stop" });
			this.worker.terminate();
		}
	}

	private async checkAndPrefetch() {
		if (this.isFetching || !this.canAttemptFetch()) {
			return;
		}

		const nextHour = this.getNextHourTimestamp();
		const cacheKey = this.getCacheKey();

		if (this.hasBackgroundForNextHour(cacheKey, nextHour)) {
			return;
		}

		await this.fetchBackground(nextHour);
	}

	private canAttemptFetch(): boolean {
		return Date.now() - this.lastFetchAttempt >= BackgroundPrefetchManager.MIN_FETCH_INTERVAL;
	}

	private getNextHourTimestamp(): Date {
		const now = new Date();
		const nextHour = new Date(now);
		nextHour.setHours(now.getHours() + 1);
		nextHour.setMinutes(0, 0, 0);
		return nextHour;
	}

	private getCacheKey(): string {
		const { backgroundTheme, customBackground } = this.settings;

		if (backgroundTheme === BackgroundTheme.CUSTOM && customBackground) {
			return `custom:${customBackground}`;
		}

		return `unsplash:${backgroundTheme}`;
	}

	private hasBackgroundForNextHour(cacheKey: string, nextHour: Date): boolean {
		return hasFreshBackground(
			this.settings.backgroundCache || {},
			cacheKey,
			{ now: nextHour }
		);
	}

	private async fetchBackground(nextHour: Date) {
		try {
			this.isFetching = true;
			this.lastFetchAttempt = Date.now();
			logger.info("Beautitab: Prefetching background for next hour...");

			await this.plugin.queryClient.prefetchQuery({
				queryKey: buildBackgroundQueryKey(this.settings, nextHour),
				queryFn: () =>
					fetchNewBackground({
						settings: this.settings,
						plugin: this.plugin,
						now: nextHour,
					}),
				staleTime: 1000 * 60 * 5,
			});
		} catch (error) {
			logger.error("Beautitab: Failed to prefetch background", error);
		} finally {
			this.isFetching = false;
		}
	}
}

/**
 * 新規タブの動作をパッチ
 */
class NewTabPatcher {
	private uninstallPatch?: () => void;

	constructor(
		private app: any,
		private settings: BeautitabPluginSettings
	) {}

	patch() {
		this.uninstallPatch = around(
			this.app.commands.commands["workspace:new-tab"],
			{
				checkCallback: (next: any) => {
					return (checking: boolean) => {
						if (this.settings.newTabBehavior === NEW_TAB_BEHAVIOR.OVERRIDE) {
							if (!checking) {
								this.app.workspace.getLeaf(true).setViewState({
									type: BEAUTITAB_REACT_VIEW,
									active: true,
								});
							}
							return true;
						}
						return next ? next(checking) : false;
					};
				},
			}
		);
	}

	unpatch() {
		if (this.uninstallPatch) {
			this.uninstallPatch();
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

	private prefetchManager?: BackgroundPrefetchManager;
	private tabPatcher?: NewTabPatcher;

	async onload() {
		await this.initializeSettings();
		this.applyLogLevel();

		logger.info("Beautitab: Plugin Loading... VERSION CHECK " + Date.now());
		DevModeManager.initialize();

		await this.initializeSettings();
		this.initializeQueryClient();
		this.cleanupLegacyStorage();
		this.setupView();
		this.setupSettingsTab();
		this.setupEventListeners();
		this.setupNewTabBehavior();

		DevModeManager.configureMobileEmulation(this.app);

		this.startBackgroundPrefetch();
	}

	onunload() {
		logger.info("unloading Beautitab");
		this.prefetchManager?.stop();
		this.tabPatcher?.unpatch();
	}

	private async initializeSettings() {
		await this.loadSettings();
		setSettings(this.settings);
	}

	private initializeQueryClient() {
		this.queryClient = new QueryClient();
	}

	private cleanupLegacyStorage() {
		if (localStorage.getItem("beautitab-bg-queue")) {
			localStorage.removeItem("beautitab-bg-queue");
		}
	}

	private setupView() {
		this.registerView(
			BEAUTITAB_REACT_VIEW,
			(leaf) => new ReactView(this.app, leaf, this)
		);
	}

	private setupSettingsTab() {
		this.addSettingTab(new BeautitabPluginSettingTab(this.app, this));
	}

	private setupEventListeners() {

	}

	private setupNewTabBehavior() {
		this.tabPatcher = new NewTabPatcher(this.app, this.settings);
		this.tabPatcher.patch();
	}

	private startBackgroundPrefetch() {
		this.prefetchManager = new BackgroundPrefetchManager(this.settings, this);
		this.prefetchManager.start();
	}

	async loadSettings() {
		const data = (await this.loadData()) || {};
		const merged = Object.assign({}, DEFAULT_SETTINGS, data);
		merged.backgroundCache = normalizeBackgroundCache(merged.backgroundCache);
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
