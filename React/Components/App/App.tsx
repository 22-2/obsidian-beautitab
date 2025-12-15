import React, { useEffect, useMemo, useState, useRef } from "react";
import { useObsidian } from "../../Context/ObsidianAppContext";
import { TFile, getIcon } from "obsidian";
import getTime from "React/Utils/getTime";
import Observable from "src/Utils/Observable";
import BeautitabPlugin from "main";
import getBackground from "React/Utils/getBackground";
import getTimeOfDayGreeting from "React/Utils/getTimeOfDayGreeting";
import { getBookmarks } from "React/Utils/getBookmarks";
import { BeautitabPluginSettings } from "src/Settings/Settings";
import getQuote from "React/Utils/getQuote";
import { BackgroundTheme } from "src/Types/Enums";
import { CachedBackground } from "../../../src/Types/Interfaces";

const preloadImage = (url: string): Promise<void> => {
	return new Promise((resolve) => {
		let settled = false;
		const finalize = () => {
			if (settled) return;
			settled = true;
			resolve();
		};
		const img = new Image();
		img.onload = finalize;
		img.onerror = finalize;
		img.src = url;
		// decode can resolve sooner without layout
		// ignore rejection to avoid stalling on decode support issues
		// eslint-disable-next-line @typescript-eslint/no-floating-promises
		img.decode?.().then(finalize).catch(finalize);
	});
};

/**
 * Given an icon name, converts a Obsidian icon to a usable SVG string and embeds it into a span.
 * @returns
 */
const Icon = ({ name }: { name: string }) => {
	const iconText = new XMLSerializer().serializeToString(
		getIcon(name) || new Node()
	);

	return (
		<span
			className="beautitab-icon"
			dangerouslySetInnerHTML={{
				__html: iconText,
			}}
		></span>
	);
};

const App = ({
	settingsObservable,
	plugin,
}: {
	settingsObservable: Observable;
	plugin: BeautitabPlugin;
}) => {
	const [quote, setQuote] = useState<{
		content: string;
		author: string;
	} | null>(null);
	const [settings, setSettings] = useState<BeautitabPluginSettings>(
		settingsObservable.getValue()
	);
	const isCachedBackgroundUsable = useMemo(() => {
		if (settings.debugRefreshBackgroundOnOpen) return false;
		const cached = settings.cachedBackground;
		if (!cached?.url) return false;
		if (
			settings.backgroundTheme === BackgroundTheme.TRANSPARENT ||
			settings.backgroundTheme === BackgroundTheme.TRANSPARENT_WITH_SHADOWS
		) {
			return false;
		}
		if (cached.theme !== settings.backgroundTheme) return false;
		if (settings.backgroundTheme === BackgroundTheme.CUSTOM) {
			const trimmed = settings.customBackground?.trim();
			return !!trimmed && trimmed === cached.url;
		}
		if (settings.backgroundTheme === BackgroundTheme.LOCAL) {
			return settings.localBackgrounds?.includes(cached.url) ?? false;
		}
		return true;
	}, [
		settings.debugRefreshBackgroundOnOpen,
		settings.cachedBackground,
		settings.backgroundTheme,
		settings.customBackground,
		settings.localBackgrounds,
	]);

	const [currentBg, setCurrentBg] = useState<CachedBackground | null>(
		isCachedBackgroundUsable ? (settings.cachedBackground ?? null) : null
	);
	const [incomingBg, setIncomingBg] = useState<CachedBackground | null>(null);
	const [isBackgroundVisible, setIsBackgroundVisible] = useState(false);
	const [isCrossfading, setIsCrossfading] = useState(false);
	const hasShownBackgroundRef = useRef(false);
	const currentBgRef = useRef<CachedBackground | null>(null);
	const [time, setTime] = useState(getTime(settings.timeFormat));
	const mainDivRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		currentBgRef.current = currentBg;
	}, [currentBg]);

	const obsidian = useObsidian();
	const backgroundResult = useMemo(async () => {
		return await getBackground(
			settings.backgroundTheme,
			settings.customBackground,
			settings.localBackgrounds,
			settings.apiKey,
			settings.backgroundCache,
			settings.debugRefreshBackgroundOnOpen
		);
	}, [
		settings.backgroundTheme,
		settings.customBackground,
		settings.localBackgrounds,
		settings.apiKey,
		settings.backgroundCache,
		settings.debugRefreshBackgroundOnOpen,
	]);

	useEffect(() => {
		if (!isCachedBackgroundUsable) return;
		if (currentBgRef.current?.url) return;
		setCurrentBg(settings.cachedBackground ?? null);
	}, [isCachedBackgroundUsable, settings.cachedBackground]);

	const backgroundStyle = useMemo<Record<string, string> & React.CSSProperties>(() => {
		const style: Record<string, string> & React.CSSProperties = {};
		if (currentBg?.url) {
			style["--beautitab-bg-url-current"] = `url("${currentBg.url}")`;
		}
		if (incomingBg?.url) {
			style["--beautitab-bg-url-next"] = `url("${incomingBg.url}")`;
		}
		return style;
	}, [currentBg?.url, incomingBg?.url]);
	useEffect(() => {
		let cancelled = false;
		let timeout: number | undefined;

		const run = async () => {
			const result = await backgroundResult;
			if (cancelled) return;
			const bg = result.background;
			if (!bg?.url) return;

			// If we have an explicit cached background and debug refresh is off,
			// keep it stable on tab open (avoid changing on every open).
			if (
				isCachedBackgroundUsable &&
				settings.cachedBackground?.url &&
				currentBgRef.current?.url === settings.cachedBackground.url
			) {
				return;
			}

			await preloadImage(bg.url);
			if (cancelled) return;

			const prev = currentBgRef.current;
			// First load with no current background
			if (!prev?.url) {
				setCurrentBg(bg);
				return;
			}

			// Same background, skip
			if (prev.url === bg.url) {
				return;
			}

			// Crossfade: keep current, fade in incoming, then swap
			setIncomingBg(bg);
			// Start crossfade on next frame to ensure CSS transition triggers
			requestAnimationFrame(() => {
				if (!cancelled) setIsCrossfading(true);
			});
			timeout = window.setTimeout(() => {
				if (cancelled) return;
				setCurrentBg(bg);
				setIncomingBg(null);
				setIsCrossfading(false);
			}, 500);
		};

		void run();
		return () => {
			cancelled = true;
			if (timeout) window.clearTimeout(timeout);
		};
	}, [backgroundResult, isCachedBackgroundUsable, settings.cachedBackground?.url]);

	useEffect(() => {
		if (!currentBg?.url && !incomingBg?.url) return;
		if (!hasShownBackgroundRef.current) {
			hasShownBackgroundRef.current = true;
			requestAnimationFrame(() => setIsBackgroundVisible(true));
			return;
		}
		setIsBackgroundVisible(true);
	}, [currentBg?.url, incomingBg?.url]);

	let shouldSave = false;
	if (
		!settings.debugRefreshBackgroundOnOpen &&
		currentBg &&
		(currentBg.url !== settings.cachedBackground?.url ||
			currentBg.theme !== settings.cachedBackground?.theme)
	) {
		plugin.settings.cachedBackground = currentBg;
		shouldSave = true;
	}
	if (shouldSave) {
		void plugin.saveSettings();
	}
	const allVaultFiles = obsidian?.vault.getAllLoadedFiles();
	const latestModifiedMarkdownFiles = useMemo(() => {
		const files = allVaultFiles?.filter(
			(file) => file instanceof TFile && file.extension === "md"
		);
		files?.sort((a, b) =>
			a instanceof TFile && b instanceof TFile
				? b.stat.mtime - a.stat.mtime
				: 0
		);
		return files?.slice(0, 5);
	}, [allVaultFiles]);

	const bookmarks = useMemo(
		() => getBookmarks(obsidian, settings).slice(0, 5),
		[obsidian, settings]
	);

	/**
	 * Keep the time up to date by updating it every second
	 * Note that this shouldn't cause extra renders because calling "setTime" with a duplicate value should skip the render
	 */
	useEffect(() => {
		const timer = setInterval(() => {
			setTime(getTime(settings.timeFormat));
		}, 1000);

		return () => {
			clearInterval(timer);
		};
	}, [setTime, settings]);

	/**
	 * Get a random quote
	 */
	useEffect(() => {
		getQuote(settings.quoteSource, settings.customQuotes).then(
			(newQuote: any) => {
				setQuote(newQuote);
			}
		);
	}, [setQuote, settings.quoteSource, settings.customQuotes]);

	/**
	 * Subscribe to settings from Obsidian
	 */
	useEffect(() => {
		const unsubscribe = settingsObservable.onChange(
			(newSettings: BeautitabPluginSettings) => {
				setSettings(newSettings);
			}
		);

		return () => {
			unsubscribe();
		};
	}, [setSettings]);

	/**
	 * Auto focus so key presses launch search
	 */
	useEffect(() => {
		mainDivRef?.current?.focus();
	}, []);

	const rootClasses = [
		"beautitab-root",
		settings.backgroundTheme === BackgroundTheme.TRANSPARENT &&
			"beautitab-root--transparent",
		settings.backgroundTheme ===
			BackgroundTheme.TRANSPARENT_WITH_SHADOWS &&
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
			onKeyDown={(e) => {
				if (!e.ctrlKey && !e.altKey && /^[A-Za-z0-9]$/.test(e.key)) {
					plugin.openSwitcherCommand(
						settings.inlineSearchProvider.command
					);
				}
			}}
			tabIndex={0} // Make the div focusable so we can capture key strokes
			ref={mainDivRef}
		>
			<div className="beautitab-wrapper">
				<div className="beautitab-top">
					{settings.showTopLeftSearchButton && (
						<a
							className="beautitab-iconbutton"
							onClick={() => {
								plugin.openSwitcherCommand(
									settings.topLeftSearchProvider.command
								);
							}}
						>
							<span className="beautitab-iconbutton-text">
								Open Search
							</span>
							<Icon name="search" />
						</a>
					)}
				</div>
				<div className="beautitab-center">
					{settings.showTime && (
						<div className="beautitab-time">{time}</div>
					)}
					{settings.showGreeting && (
						<div className="beautitab-greeting">
							{settings.greetingText.replace(
								/{{greeting}}/gi,
								getTimeOfDayGreeting()
							)}
						</div>
					)}
				</div>
				<div className="beautitab-bottom">
					<div className="beautitab-search">
						{settings.showInlineSearch && (
							<a
								className="beautitab-search-wrapper"
								onClick={() => {
									plugin.openSwitcherCommand(
										settings.inlineSearchProvider.command
									);
								}}
							>
								<Icon name="search" />
								<span className="beautitab-search-text">
									Search
								</span>
							</a>
						)}
					</div>
					{settings.showRecentFiles && (
						<div className="beautitab-recentlyedited">
							{latestModifiedMarkdownFiles?.map(
								(file) =>
									file instanceof TFile && (
										<a
											key={file.path}
											className="beautitab-recentlyedited-file"
											data-path={file.path}
											onClick={() => {
												const leaf =
													obsidian?.workspace.getMostRecentLeaf();
												if (file instanceof TFile) {
													leaf?.openFile(file);
												}
											}}
										>
											<Icon name="file" />
											<span className="beautitab-recentlyedited-file-name">
												{file.basename}
											</span>
										</a>
									)
							)}
						</div>
					)}
					{settings.showBookmarks && (
						<div className="beautitab-recentlyedited">
							{bookmarks?.map(
								(file: TFile) =>
									file && (
										<a
											key={file.path}
											className="beautitab-recentlyedited-file"
											data-path={file.path}
											onClick={() => {
												const leaf =
													obsidian?.workspace.getMostRecentLeaf();
												if (file instanceof TFile) {
													leaf?.openFile(file);
												}
											}}
										>
											<Icon name="bookmark" />
											<span className="beautitab-recentlyedited-file-name">
												{file.basename}
											</span>
										</a>
									)
							)}
						</div>
					)}
				</div>
				<div className="beautitab-quote">
					{quote && settings.showQuote && (
						<div className="beautitab-quote-content">
							&quot;{quote.content}&quot;
						</div>
					)}
					{quote && settings.showQuote && (
						<div className="beautitab-quote-author">
							{quote.author}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default App;
