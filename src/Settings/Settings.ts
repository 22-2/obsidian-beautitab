import fs from "fs";
import { getBookmarkGroups } from "React/Utils/getBookmarks";
import BeautitabPlugin from "main";
import { App, Notice, PluginSettingTab, Setting, arrayBufferToBase64, sanitizeHTMLToDom } from "obsidian";
import ChooseSearchProvider from "src/ChooseSearchProvider/ChooseSearchProvider";
import CustomQuotesModel from "src/CustomQuotesModel/CustomQuotesModel";
import {
	BOOKMARK_SOURCE,
	BackgroundTheme,
	NEW_TAB_BEHAVIOR,
	QUOTE_SOURCE,
	TIME_FORMAT,
} from "src/Types/Enums";
import { BackgroundCache, CachedBackground, CustomQuote, SearchProvider } from "src/Types/Interfaces";
import capitalizeFirstLetter from "src/Utils/capitalizeFirstLetter";
import electron from "electron";
import ConfirmModal from "src/ConfirmModal/ConfirmModal";
import ChooseImageSuggestModal from "src/ChooseImageSuggestModal/ChooseImageSuggestModal";

const DEFAULT_SEARCH_PROVIDER: SearchProvider = {
	command: "switcher:open",
	display: "Obsidian Core Quick Switcher",
};

export const SEARCH_PROVIDER = [
	"switcher",
	"omnisearch",
	"darlal-switcher-plus",
	"obsidian-another-quick-switcher",
];

export interface BeautitabPluginSettings {
	backgroundTheme: BackgroundTheme;
	customBackground: string;
	localBackgrounds: string[];
	debugRefreshBackgroundOnOpen: boolean;
	showTopLeftSearchButton: boolean;
	topLeftSearchProvider: SearchProvider;
	showTime: boolean;
	timeFormat: TIME_FORMAT;
	showGreeting: boolean;
	greetingText: string;
	showInlineSearch: boolean;
	inlineSearchProvider: SearchProvider;
	refreshBackgroundOnHourChange: boolean;
	showRecentFiles: boolean;
	showBookmarks: boolean;
	bookmarkSource: BOOKMARK_SOURCE;
	bookmarkGroup: string;
	showQuote: boolean;
	quoteSource: QUOTE_SOURCE;
	customQuotes: CustomQuote[];
	apiKey: string;
	newTabBehavior: NEW_TAB_BEHAVIOR;
	cachedBackground?: CachedBackground;
	backgroundCache?: BackgroundCache;
}

export const DEFAULT_SETTINGS: BeautitabPluginSettings = {
	backgroundTheme: BackgroundTheme.SEASONS_AND_HOLIDAYS,
	customBackground: "",
	localBackgrounds: [],
	debugRefreshBackgroundOnOpen: false,
	showTopLeftSearchButton: true,
	topLeftSearchProvider: DEFAULT_SEARCH_PROVIDER,
	showTime: true,
	timeFormat: TIME_FORMAT.TWELVE_HOUR,
	showGreeting: true,
	greetingText: "Hello, Beautiful.",
	showInlineSearch: true,
	inlineSearchProvider: DEFAULT_SEARCH_PROVIDER,
	refreshBackgroundOnHourChange: true,
	showRecentFiles: true,
	showBookmarks: false,
	bookmarkSource: BOOKMARK_SOURCE.ALL,
	bookmarkGroup: "",
	showQuote: true,
	quoteSource: QUOTE_SOURCE.QUOTEABLE,
	customQuotes: [],
	apiKey: "",
	newTabBehavior: NEW_TAB_BEHAVIOR.HIJACK,
	backgroundCache: {},
};

export class BeautitabPluginSettingTab extends PluginSettingTab {
	plugin: BeautitabPlugin;

	constructor(app: App, plugin: BeautitabPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		/****************************************
		 * General settings
		 ***************************************/
		new Setting(containerEl).setHeading().setName(`General settings`);

		new Setting(containerEl)
			.setName("New tab behavior")
			.setDesc(
				`How should Beautitab handle new tabs? "Hijack empty tabs" will replace any empty tab with Beautitab. "Override New Tab command" will override the default Obsidian "New tab" command. "None" will do nothing.`
			)
			.addDropdown((component) => {
				Object.values(NEW_TAB_BEHAVIOR).forEach((behavior) => {
					component.addOption(behavior, behavior);
				});

				component.setValue(this.plugin.settings.newTabBehavior);
				component.onChange((value: NEW_TAB_BEHAVIOR) => {
					this.plugin.settings.newTabBehavior = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
				});
			});

		/****************************************
		 * Background settings
		 ***************************************/
		new Setting(containerEl).setHeading().setName(`Background settings`);

		const backgroundApiKeyDesc = `Register your unsplash access key at <a href="https://unsplash.com/developers">unsplash.com/developers</a> to get access to random image. Leave empty if you use local image or custom URL.`;
		new Setting(containerEl)
			.setName("Unsplash access key")
			.setDesc(sanitizeHTMLToDom(backgroundApiKeyDesc))
			.addText((component) => {
				component.setValue(this.plugin.settings.apiKey);
				component.onChange((value) => {
					this.plugin.settings.apiKey = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Background theme")
			.setDesc(
				`What theme would you like to utilize for the random backgrounds? "Seasons and Holidays" will use a different tag depending on the time of the year. Custom will allow you to input your own url. Local will use the local images imported below.`
			)
			.addDropdown((component) => {
				Object.values(BackgroundTheme).forEach((theme) => {
					component.addOption(theme, capitalizeFirstLetter(theme));
				});

				component.setValue(this.plugin.settings.backgroundTheme);

				component.onChange((value: BackgroundTheme) => {
					this.plugin.settings.backgroundTheme = value;
					
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		if (this.plugin.settings.backgroundTheme === BackgroundTheme.CUSTOM) {
			new Setting(containerEl)
				.setName("Custom background url")
				.setDesc(`What url should be used for the background image?`)
				.addText((component) => {
					component.setValue(this.plugin.settings.customBackground);
					component.onChange((value) => {
						this.plugin.settings.customBackground = value;
						this.plugin.settingsObservable.setValue(
							this.plugin.settings
						);
						this.plugin.saveSettings();
						this.display();
					});
				});
		}

		const localBackgroundImagesSetting = new Setting(containerEl).setName(
			"Local background images"
		);

		new Setting(containerEl)
			.setName("Debug: refresh background on every tab open")
			.setDesc(
				"Force-fetch a new background each time a Beautitab view opens. This bypasses cached backgrounds and may hit the API more often."
			)
			.addToggle((component) => {
				component.setValue(
					this.plugin.settings.debugRefreshBackgroundOnOpen
				);
				component.onChange((value) => {
					this.plugin.settings.debugRefreshBackgroundOnOpen = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Refresh background on hour change")
			.setDesc(
				"Automatically switch to a new background when the hour changes while the tab is open. If disabled, the background will only change when you open a new tab."
			)
			.addToggle((component) => {
				component.setValue(
					this.plugin.settings.refreshBackgroundOnHourChange
				);
				component.onChange((value) => {
					this.plugin.settings.refreshBackgroundOnHourChange = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
				});
			});

		// @ts-ignore
		if (!this.app.isMobile) {
			localBackgroundImagesSetting.addButton((component) => {
				component.setButtonText("Add local image");
				component.onClick(() => {
					// @ts-ignore
					electron.remote.dialog
						.showOpenDialog({
							properties: ["openFile", "multiSelections"],
							title: "Add background images",
							filters: [
								{ name: "Images", extensions: ["jpg", "png"] },
							],
						})
						.then((result: any) => {
							if (!result.canceled) {
								result.filePaths.forEach((filePath: string) => {
									const fileData = fs.readFileSync(filePath);
									const base64Data =
										fileData.toString("base64");

									this.plugin.settings.localBackgrounds.push(
										`data:image/png;base64,${base64Data}`
									);
								});

								this.plugin.saveSettings();
								this.display();
							}
						});
				});
			});
		}

		localBackgroundImagesSetting.addButton((component) => {
			component.setButtonText("Add vault image");
			component.onClick(() => {
				new ChooseImageSuggestModal(this.app, async (result: any) => {
					const fileData = await this.app.vault.readBinary(result);
					const base64Data = arrayBufferToBase64(fileData);

					this.plugin.settings.localBackgrounds.push(
						`data:image/png;base64,${base64Data}`
					);
					this.plugin.saveSettings();
					this.display();
				}).open();
			});
		});

		new Setting(containerEl)
			.setName("Background cache")
			.setDesc(
				"Manage cached backgrounds that reduce repeated downloads. Clearing will force the next load to refetch."
			)
			.addButton((component) => {
				component.setButtonText("Clear cache").onClick(() => {
					this.plugin.settings.backgroundCache = {};
					this.plugin.settings.cachedBackground = undefined;
					this.plugin.saveSettings();
					new Notice("Background cache cleared.");
					this.display();
				});
			});

		const localBackgroundsDiv = containerEl.createEl("div", {
			cls: "beautitabsettings-localbackgrounds",
		});

		this.plugin.settings.localBackgrounds.forEach(
			(localBackground: string, index: number) => {
				const backgroundDiv = localBackgroundsDiv.createEl("div", {
					cls: "beautitabsettings-localbackgrounds-background",
				});
				backgroundDiv.createEl("img", {
					attr: {
						src: localBackground,
					},
				});
				backgroundDiv.createEl("button", {
					text: "x",
					cls: "beautitabsettings-localbackgrounds-background-delete",
				});
				backgroundDiv.addEventListener("click", () => {
					new ConfirmModal(
						this.app,
						() => {
							this.plugin.settings.localBackgrounds.splice(
								index,
								1
							);
							this.plugin.saveSettings();
							this.display();
						},
						"Remove background",
						`Are you sure?`,
						"Remove"
					).open();
				});
			}
		);

		/****************************************
		 * Search settings
		 ***************************************/
		new Setting(containerEl).setHeading().setName(`Search settings`);

		new Setting(containerEl)
			.setName("Show top left search button")
			.setDesc(
				`Should the search button at the top left of the new tab screen be displayed?`
			)
			.addToggle((component) => {
				component.setValue(
					this.plugin.settings.showTopLeftSearchButton
				);
				component.onChange((value) => {
					this.plugin.settings.showTopLeftSearchButton = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Top left search provider")
			.setDesc(
				`Which plugin should be utilized for search when clicking the top left button?`
			)
			.setClass("search-provider")
			.addText((component) => {
				component.setValue(
					this.plugin.settings.topLeftSearchProvider.display
				);
				component.setDisabled(true);
			})
			.addButton((component) => {
				component.setButtonText("Change");
				component.setTooltip("Choose search provider");
				component.onClick(() => {
					new ChooseSearchProvider(
						this.app,
						this.plugin.settings,
						(result: SearchProvider) => {
							this.plugin.settings.topLeftSearchProvider = result;
							this.plugin.settingsObservable.setValue(
								this.plugin.settings
							);
							this.plugin.saveSettings();
							this.display();
						}
					).open();
				});
			});

		new Setting(containerEl)
			.setName("Show inline search")
			.setDesc(
				`Should the inline search in the middle of the new tab screen be displayed?`
			)
			.addToggle((component) => {
				component.setValue(this.plugin.settings.showInlineSearch);
				component.onChange((value) => {
					this.plugin.settings.showInlineSearch = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Inline search provider")
			.setDesc(
				`Which plugin should be utilized for search when clicking the middle of the screen button?`
			)
			.setClass("search-provider")

			.addText((component) => {
				component
					.setValue(this.plugin.settings.inlineSearchProvider.display)
					.setDisabled(true);
			})
			.addButton((component) => {
				component.setButtonText("Change");
				component.setTooltip("Choose search provider");
				component.onClick(() => {
					new ChooseSearchProvider(
						this.app,
						this.plugin.settings,
						(result: SearchProvider) => {
							this.plugin.settings.inlineSearchProvider = result;
							this.plugin.settingsObservable.setValue(
								this.plugin.settings
							);
							this.plugin.saveSettings();
							this.display();
						}
					).open();
				});
			});

		/****************************************
		 * Time settings
		 ***************************************/
		new Setting(containerEl).setHeading().setName(`Time settings`);

		new Setting(containerEl)
			.setName("Show time")
			.setDesc(
				`Should the time in the middle of the new tab screen be displayed?`
			)
			.addToggle((component) => {
				component.setValue(this.plugin.settings.showTime);
				component.onChange((value) => {
					this.plugin.settings.showTime = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Time format")
			.setDesc(`Should the time be in 12-hour format or 24-hour format?`)
			.addDropdown((component) => {
				component.addOption(
					TIME_FORMAT.TWELVE_HOUR,
					TIME_FORMAT.TWELVE_HOUR
				);
				component.addOption(
					TIME_FORMAT.TWENTY_FOUR_HOUR,
					TIME_FORMAT.TWENTY_FOUR_HOUR
				);

				component.setValue(this.plugin.settings.timeFormat);

				component.onChange((value: TIME_FORMAT) => {
					this.plugin.settings.timeFormat = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		/****************************************
		 * Greeting settings
		 ***************************************/
		new Setting(containerEl).setHeading().setName(`Greeting settings`);

		new Setting(containerEl)
			.setName("Show greeting")
			.setDesc(
				`Should the greeting in the middle of the new tab screen be displayed?`
			)
			.addToggle((component) => {
				component.setValue(this.plugin.settings.showGreeting);
				component.onChange((value) => {
					this.plugin.settings.showGreeting = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Greeting text")
			.setDesc(
				`What text should be displayed as a greeting? You can use the {{greeting}} to add a greeting based on the time of the day. (E.g. Good morning)`
			)
			.addText((component) => {
				component.setValue(this.plugin.settings.greetingText);
				component.onChange((value) => {
					this.plugin.settings.greetingText = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
				});
			});

		/****************************************
		 * Recent file settings
		 ***************************************/
		new Setting(containerEl).setHeading().setName(`Recent file settings`);

		new Setting(containerEl)
			.setName("Show recent files")
			.setDesc(
				`Should recent files in the middle of the new tab screen be displayed?`
			)
			.addToggle((component) => {
				component.setValue(this.plugin.settings.showRecentFiles);
				component.onChange((value) => {
					this.plugin.settings.showRecentFiles = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		/****************************************
		 * Bookmark settings
		 ***************************************/
		new Setting(containerEl).setHeading().setName(`Bookmark settings`);

		new Setting(containerEl)
			.setName("Show bookmarks")
			.setDesc(
				`Should bookmarks in the middle of the new tab screen be displayed?`
			)
			.addToggle((component) => {
				component.setValue(this.plugin.settings.showBookmarks);
				component.onChange((value) => {
					this.plugin.settings.showBookmarks = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Bookmarks source")
			.setDesc(
				`Should all bookmarks be displayed or bookmarks from a specific group?`
			)
			.addDropdown((component) => {
				component.addOption(BOOKMARK_SOURCE.ALL, "All bookmarks");
				component.addOption(
					BOOKMARK_SOURCE.GROUP,
					"Bookmarks from group"
				);

				component.setValue(this.plugin.settings.bookmarkSource);
				component.onChange((value: BOOKMARK_SOURCE) => {
					this.plugin.settings.bookmarkSource = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		if (this.plugin.settings.bookmarkSource === BOOKMARK_SOURCE.GROUP) {
			new Setting(containerEl)
				.setName("Bookmarks group")
				.setDesc(`Which group should bookmarks be pulled from?`)
				.addDropdown((component) => {
					getBookmarkGroups(this.app).forEach(
						(group: { title: string; path: string }) => {
							component.addOption(group.title, group.path);
						}
					);

					component.setValue(this.plugin.settings.bookmarkGroup);
					component.onChange((value: BOOKMARK_SOURCE) => {
						this.plugin.settings.bookmarkGroup = value;
						this.plugin.settingsObservable.setValue(
							this.plugin.settings
						);
						this.plugin.saveSettings();
						this.display();
					});
				});
		}

		/****************************************
		 * Quote settings
		 ***************************************/
		new Setting(containerEl).setHeading().setName(`Quote settings`);

		new Setting(containerEl)
			.setName("Show quote")
			.setDesc(
				`Should the quote at the bottom of the new tab screen be displayed?`
			)
			.addToggle((component) => {
				component.setValue(this.plugin.settings.showQuote);
				component.onChange((value) => {
					this.plugin.settings.showQuote = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Quote source")
			.setDesc(
				`Where should quotes be pulled from? You can use either built in quotes, your own quotes, or a combination of both.`
			)
			.addDropdown((component) => {
				Object.values(QUOTE_SOURCE).forEach((source) => {
					const val = source as QUOTE_SOURCE;
					component.addOption(val, val);
				});

				component.setValue(this.plugin.settings.quoteSource);
				component.onChange((value: QUOTE_SOURCE) => {
					this.plugin.settings.quoteSource = value;
					this.plugin.settingsObservable.setValue(
						this.plugin.settings
					);
					this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Custom quotes")
			.setDesc(`${this.plugin.settings.customQuotes.length} quotes`)
			.addButton((component) => {
				component.setButtonText("Edit");

				component.onClick(() => {
					new CustomQuotesModel(
						this.plugin,
						(modifiedCustomQuotes: CustomQuote[]) => {
							this.plugin.settings.customQuotes =
								modifiedCustomQuotes;
							this.plugin.saveSettings();
							this.display();
						}
					).open();
				});
			});
	}
}
