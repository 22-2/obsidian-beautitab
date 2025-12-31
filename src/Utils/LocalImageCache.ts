import { normalizePath } from "obsidian";
import { format, differenceInDays } from "date-fns";
import log from "loglevel";
import { fetchPolyfillSafe } from ".//fetchPolyfillSafe";
import BeautitabPlugin from "main";

const logger = log.getLogger("Beautytab:LocalImageCache");

const CACHE_FOLDER = "bg-cache";
const MAX_AGE_DAYS = 3;

/**
 * Simple local image cache for background images.
 * Downloads remote images and stores them in the plugin folder.
 */
export class LocalImageCache {
	private plugin: BeautitabPlugin;
	private cacheDir: string;

	constructor(plugin: BeautitabPlugin) {
		this.plugin = plugin;
		this.cacheDir = normalizePath(`${plugin.manifest.dir}/${CACHE_FOLDER}`);
	}

	private get adapter() {
		return this.plugin.app.vault.adapter;
	}

	/**
	 * Ensures the cache directory exists
	 */
	async ensureDir(): Promise<void> {
		if (!(await this.adapter.exists(this.cacheDir))) {
			await this.adapter.mkdir(this.cacheDir);
		}
	}

	/**
	 * Get cached wallpaper for a specific theme and hour.
	 * Returns the file path if found, null otherwise.
	 */
	async getForHour(theme: string, date: Date = new Date()): Promise<string | null> {
		try {
			await this.ensureDir();
			const prefix = this.generatePrefix(theme, date);
			const { files } = await this.adapter.list(this.cacheDir);
			
			// Find file matching this theme+hour
			const match = files.find((f) => {
				const filename = f.split("/").pop() || "";
				return filename.startsWith(prefix);
			});

			if (match) {
				logger.debug("Found cached wallpaper:", match);
				return match;
			}
			return null;
		} catch (e) {
			logger.error("getForHour error:", e);
			return null;
		}
	}

	/**
	 * Downloads and caches an image, returning the local path.
	 * If already cached or local, returns the existing path.
	 */
	async cache(url: string, theme: string, date: Date = new Date()): Promise<string | null> {
		if (!url) return null;

		// Already local
		if (!url.startsWith("http")) {
			return url;
		}

		try {
			await this.ensureDir();

			const filename = this.generateFilename(url, theme, date);
			const filePath = normalizePath(`${this.cacheDir}/${filename}`);

			// Already cached
			if (await this.adapter.exists(filePath)) {
				logger.debug("Cache hit:", filePath);
				return filePath;
			}

			// Download using rate-limited fetch
			logger.debug("Downloading:", url);
			const response = await fetchPolyfillSafe(url);

			if (!response.ok) {
				logger.error("Download failed:", response.status);
				return null;
			}

			const buffer = await response.arrayBuffer();
			await this.adapter.writeBinary(filePath, buffer);
			logger.debug("Cached:", filePath);
			return filePath;
		} catch (e) {
			logger.error("Cache error:", e);
			return null;
		}
	}

	/**
	 * Gets the resource path for display in browser
	 */
	getResourcePath(filePath: string): string {
		return this.adapter.getResourcePath(filePath);
	}

	/**
	 * Removes files older than MAX_AGE_DAYS
	 */
	async prune(): Promise<void> {
		try {
			if (!(await this.adapter.exists(this.cacheDir))) return;

			const { files } = await this.adapter.list(this.cacheDir);
			const now = new Date();

			for (const file of files) {
				const stat = await this.adapter.stat(file);
				if (stat && differenceInDays(now, new Date(stat.mtime)) > MAX_AGE_DAYS) {
					await this.adapter.remove(file);
					logger.debug("Pruned:", file);
				}
			}
		} catch (e) {
			logger.error("Prune error:", e);
		}
	}

	/**
	 * Clears all cached files
	 */
	async clear(): Promise<void> {
		try {
			if (!(await this.adapter.exists(this.cacheDir))) return;

			const { files } = await this.adapter.list(this.cacheDir);
			await Promise.all(files.map((f) => this.adapter.remove(f)));
			logger.debug("Cache cleared");
		} catch (e) {
			logger.error("Clear error:", e);
		}
	}

	/**
	 * Generates prefix for searching cached files (theme + hour)
	 */
	private generatePrefix(theme: string, date: Date): string {
		const hourStamp = format(date, "yyyy-MM-dd_HH");
		const themeSlug = this.slugify(theme);
		return `${themeSlug}-${hourStamp}-`;
	}

	/**
	 * Generates a deterministic filename based on URL, theme and hour
	 */
	private generateFilename(url: string, theme: string, date: Date): string {
		const hourStamp = format(date, "yyyy-MM-dd_HH");
		const themeSlug = this.slugify(theme);
		const urlHash = this.simpleHash(url);
		return `${themeSlug}-${hourStamp}-${urlHash}.jpg`;
	}

	private slugify(str: string): string {
		return str
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 20);
	}

	private simpleHash(str: string): string {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash |= 0;
		}
		return Math.abs(hash).toString(36);
	}
}

