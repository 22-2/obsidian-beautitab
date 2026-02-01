import BeautitabPlugin from "main";
import { Modal, Setting } from "obsidian";
import { CustomQuote } from "React/Components/App/hooks/background/types";

class CustomQuotesModel extends Modal {
	_onSave: Function;
	_plugin: BeautitabPlugin;
	_customQuotes: CustomQuote[];

	constructor(plugin: BeautitabPlugin, onSave: Function) {
		super(plugin.app);
		this._plugin = plugin;
		this._onSave = onSave;
		// Ugly way to deep clone the array and its objects
		this._customQuotes = JSON.parse(
			JSON.stringify(this._plugin.settings.customQuotes)
		);
	}

	onOpen() {
		this.display();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	display(): void {
		const { contentEl } = this;

		contentEl.empty();

		contentEl.createEl("h2", { text: "Custom quotes" });
		contentEl.createEl("p", {
			text: "Enter your custom quotes in CSV format (text, author). One quote per line.",
		});

		const csvContent = this._customQuotes
			.map((q) => `${q.text}, ${q.author}`)
			.join("\n");

		let currentCSV = csvContent;

		const textArea = contentEl.createEl("textarea", {
			cls: "beautitab-custom-quotes-textarea",
		});
		textArea.value = csvContent;
		textArea.style.width = "100%";
		textArea.style.height = "300px";
		textArea.addEventListener("input", (e: any) => {
			currentCSV = e.target.value;
		});

		new Setting(contentEl).addButton((component) => {
			component.setButtonText("Save");

			component.setCta().onClick(() => {
				const lines = currentCSV.split("\n");
				const newQuotes: CustomQuote[] = lines
					.map((line) => {
						const lastCommaIndex = line.lastIndexOf(",");
						if (lastCommaIndex === -1) {
							return { text: line.trim(), author: "" };
						}
						const text = line.substring(0, lastCommaIndex).trim();
						const author = line.substring(lastCommaIndex + 1).trim();
						return { text, author };
					})
					.filter((q) => q.text !== "");

				this._onSave(newQuotes);
				this.close();
			});
		});
	}
}

export default CustomQuotesModel;
