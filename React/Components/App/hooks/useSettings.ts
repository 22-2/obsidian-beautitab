import { useState, useEffect } from "react";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import Observable from "src/Utils/Observable";

export const useSettings = (
	settingsObservable: Observable
): BeautitabPluginSettings => {
	const [settings, setSettings] = useState<BeautitabPluginSettings>(
		settingsObservable.getValue()
	);

	useEffect(() => {
		const unsubscribe = settingsObservable.onChange(
			(newSettings: BeautitabPluginSettings) => {
				setSettings(newSettings);
			}
		);

		return () => {
			unsubscribe();
		};
	}, [settingsObservable]);

	return settings;
};
