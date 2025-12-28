import { atom, createStore } from "jotai";
import { BeautitabPluginSettings } from "src/Settings/Settings";

// Jotai store instance (shared across React and non-React code)
export const settingsStore = createStore();

// Settings atom
export const settingsAtom = atom<BeautitabPluginSettings | null>(null);

/**
 * Update settings from outside React (e.g., from plugin code)
 */
export const setSettings = (settings: BeautitabPluginSettings): void => {
	settingsStore.set(settingsAtom, { ...settings });
};

/**
 * Get current settings value
 */
export const getSettings = (): BeautitabPluginSettings | null => {
	return settingsStore.get(settingsAtom);
};
