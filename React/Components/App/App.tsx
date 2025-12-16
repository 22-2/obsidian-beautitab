import React, { useEffect, useMemo, useRef } from "react";
import { useObsidian } from "../../Context/ObsidianAppContext";
import { TFile } from "obsidian";
import Observable from "src/Utils/Observable";
import BeautitabPlugin from "main";
import { getBookmarks } from "React/Utils/getBookmarks";
import { BackgroundTheme } from "src/Types/Enums";

// Hooks
import {
	useBackground,
	useTime,
	useQuote,
	useSettings,
	useRecentFiles,
} from "./hooks";

// Components
import {
	TimeDisplay,
	Greeting,
	QuoteDisplay,
	SearchButton,
	InlineSearch,
	FileList,
} from "./components";

interface AppProps {
	settingsObservable: Observable;
	plugin: BeautitabPlugin;
}

const App: React.FC<AppProps> = ({ settingsObservable, plugin }) => {
	const mainDivRef = useRef<HTMLDivElement>(null);
	const obsidian = useObsidian();

	// Custom hooks
	const settings = useSettings(settingsObservable);
	const time = useTime(settings.timeFormat);
	const quote = useQuote(settings.quoteSource, settings.customQuotes);
	const {
		isBackgroundVisible,
		isCrossfading,
		backgroundStyle,
	} = useBackground(settings, plugin);
	const recentFiles = useRecentFiles(obsidian, 5);

	// Bookmarks
	const bookmarks = useMemo(
		() => getBookmarks(obsidian, settings).slice(0, 5) as TFile[],
		[obsidian, settings]
	);

	// Auto focus for keyboard shortcuts
	useEffect(() => {
		mainDivRef?.current?.focus();
	}, []);

	// Event handlers
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!e.ctrlKey && !e.altKey && /^[A-Za-z0-9]$/.test(e.key)) {
			plugin.openSwitcherCommand(settings.inlineSearchProvider.command);
		}
	};

	const handleTopLeftSearchClick = () => {
		plugin.openSwitcherCommand(settings.topLeftSearchProvider.command);
	};

	const handleInlineSearchClick = () => {
		plugin.openSwitcherCommand(settings.inlineSearchProvider.command);
	};

	// Build root class names
	const rootClasses = [
		"beautitab-root",
		settings.backgroundTheme === BackgroundTheme.TRANSPARENT &&
			"beautitab-root--transparent",
		settings.backgroundTheme === BackgroundTheme.TRANSPARENT_WITH_SHADOWS &&
			"beautitab-root--transparentWithShadows",
		isBackgroundVisible && "beautitab-root--bg-visible",
		isCrossfading && "beautitab-root--bg-crossfade",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			className={rootClasses}
			style={backgroundStyle}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			ref={mainDivRef}
		>
			<div className="beautitab-wrapper">
				{/* Top Section */}
				<div className="beautitab-top">
					{settings.showTopLeftSearchButton && (
						<SearchButton
							onClick={handleTopLeftSearchClick}
							label="Open Search"
						/>
					)}
				</div>

				{/* Center Section */}
				<div className="beautitab-center">
					{settings.showTime && <TimeDisplay time={time} />}
					{settings.showGreeting && (
						<Greeting greetingText={settings.greetingText} />
					)}
				</div>

				{/* Bottom Section */}
				<div className="beautitab-bottom">
					{settings.showInlineSearch && (
						<InlineSearch onClick={handleInlineSearchClick} />
					)}
					{settings.showRecentFiles && (
						<FileList
							files={recentFiles}
							obsidianApp={obsidian}
							iconName="file"
						/>
					)}
					{settings.showBookmarks && (
						<FileList
							files={bookmarks}
							obsidianApp={obsidian}
							iconName="bookmark"
						/>
					)}
				</div>

				{/* Quote Section */}
				<QuoteDisplay quote={quote} showQuote={settings.showQuote} />
			</div>
		</div>
	);
};

export default App;
