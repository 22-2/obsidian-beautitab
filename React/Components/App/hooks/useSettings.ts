import { useAtomValue } from "jotai";
import { BeautitabPluginSettings, DEFAULT_SETTINGS } from "src/Settings/Settings";
import { settingsAtom, settingsStore } from "src/Utils/settingsStore";

export const useSettings = (): BeautitabPluginSettings => {
	const settings = useAtomValue(settingsAtom, { store: settingsStore });
	return settings ?? DEFAULT_SETTINGS;
};
