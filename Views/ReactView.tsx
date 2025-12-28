import { App, FileView, TFile, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import ReactApp from "../React/Components/App/App";
import { ObsidianContext } from "../React/Context/ObsidianAppContext";
import { settingsStore } from "src/Utils/settingsStore";
import BeautitabPlugin from "main";

export const BEAUTITAB_REACT_VIEW = "beautitab-react-view";
const Translate = i18next.t.bind(i18next);

export class ReactView extends FileView {
	root: Root | null = null;
	app: App;
	plugin: BeautitabPlugin;

	constructor(
		app: App,
		leaf: WorkspaceLeaf,
		plugin: BeautitabPlugin
	) {
		super(leaf);
		this.app = app;
		this.allowNoFile = true;
		this.plugin = plugin;
		this.file = {
			path: "beautitab-virtual.md",
			name: "beautitab-virtual.md",
			basename: "beautitab-virtual",
			extension: "md",
			vault: this.app.vault,
			parent: null,
			stat: { ctime: 0, mtime: 0, size: 0 },
		} as unknown as TFile;
		// Dummy file to satisfy FileView requirements
	}

	getViewType() {
		return BEAUTITAB_REACT_VIEW;
	}

	getDisplayText() {
		return Translate("interface.label-new-tab");
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
