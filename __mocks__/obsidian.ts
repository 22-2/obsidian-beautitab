import { vi } from "vitest";

export const requestUrl = vi.fn();
export const normalizePath = vi.fn((path) => path);
export class TFile {}
export class Plugin {
	loadData = vi.fn();
	saveData = vi.fn();
	registerView = vi.fn();
	registerEvent = vi.fn();
	addSettingTab = vi.fn();
	registerInterval = vi.fn();
}
export class PluginSettingTab {
	constructor(app: any, plugin: any) {}
	display() {}
}
export class Setting {
	constructor(containerEl: HTMLElement) {}
	setName = vi.fn().mockReturnThis();
	setDesc = vi.fn().mockReturnThis();
	addText = vi.fn().mockReturnThis();
	addDropdown = vi.fn().mockReturnThis();
	addToggle = vi.fn().mockReturnThis();
	addButton = vi.fn().mockReturnThis();
	addSlider = vi.fn().mockReturnThis();
}
export const Platform = {
	isMobile: false,
};
