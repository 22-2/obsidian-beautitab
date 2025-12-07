import { BackgroundTheme } from "./Enums";
import type {i18n} from "i18next";

export interface SearchProvider {
	command: string;
	display: string;
}

export interface CustomQuote {
	text: string;
	author: string;
}

export interface CachedBackground {
	url: string;
	date: Date;
	theme?: BackgroundTheme;
}

export interface CachedBackgroundItem {
	url: string;
	date: string;
	theme?: BackgroundTheme;
	attribution?: string;
	width?: number;
	height?: number;
}

export interface BackgroundCacheEntry {
	items: CachedBackgroundItem[];
	lastUsedIndex: number;
	lastFetchedAt?: string;
	ttlMinutes?: number;
}

export type BackgroundCache = Record<string, BackgroundCacheEntry>;

declare global {
	const i18next: i18n;
  }
