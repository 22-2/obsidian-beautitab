import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import ReactApp from "../React/Components/App/App";
import { ObsidianContext } from "../React/Context/ObsidianAppContext";
import { settingsStore } from "src/Utils/settingsStore";
import BeautitabPlugin from "main";

export const BEAUTITAB_REACT_VIEW = "beautitab-react-view";

export class ReactView extends ItemView {
	root: Root | null = null;
	app: App;
	plugin: BeautitabPlugin;
	navigation = true;

	constructor(
		app: App,
		leaf: WorkspaceLeaf,
		plugin: BeautitabPlugin
	) {
		super(leaf);
		this.app = app;
		this.plugin = plugin;
	}

	getViewType() {
		return BEAUTITAB_REACT_VIEW;
	}

	getDisplayText() {
		return "New Tab";
	}

	getIcon() {
		return "";
	}

	async onOpen() {
		this.root = createRoot(this.contentEl);
		this.root.render(
			<JotaiProvider store={settingsStore}>
				<QueryClientProvider client={this.plugin.queryClient}>
					<ObsidianContext.Provider value={this.app}>
						<ReactApp plugin={this.plugin} />
					</ObsidianContext.Provider>
				</QueryClientProvider>
			</JotaiProvider>
		);
		this.containerEl.addClass("beautitab");
	}

	async onClose() {
		this.root?.unmount();
	}
}
