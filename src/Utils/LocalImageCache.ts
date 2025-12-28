import fs from "fs";
import { requestUrl, normalizePath } from "obsidian";
import BeautitabPlugin from "main";
import fnv1a from "fnv1a";
import logger from "./logger";

const CACHE_FOLDER_NAME = "bg-cache";
const MAX_CACHE_AGE_DAYS = 3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface ImageMeta {
    theme?: string;
    date?: Date;
}

export class LocalImageCache {
    plugin: BeautitabPlugin;
    cacheDir: string;

    constructor(plugin: BeautitabPlugin) {
        this.plugin = plugin;
        this.cacheDir = normalizePath(`${this.plugin.manifest.dir}/${CACHE_FOLDER_NAME}`);
    }

    async init(): Promise<void> {
        const adapter = this.plugin.app.vault.adapter;
        if (!(await adapter.exists(this.cacheDir))) {
            await adapter.mkdir(this.cacheDir);
        }
    }

    async saveImage(url: string, meta?: ImageMeta): Promise<string | null> {
        try {
            logger.debug("Beautitab: LocalImageCache.saveImage called", { url, meta });
            await this.init();

            if (await this.isLocalPath(url)) {
                logger.debug("Beautitab: URL is already local path, returning as-is", url);
                return url;
            }

            const filename = this.buildDeterministicFilename(url, meta);
            const filePath = normalizePath(`${this.cacheDir}/${filename}`);
            logger.debug("Beautitab: Cache file path", { filename, filePath });

            if (await this.exists(filePath)) {
                logger.debug("Beautitab: Cache file already exists", filePath);
                return filePath;
            }

            logger.debug("Beautitab: Downloading and saving to cache", { url, filePath });
            return await this.downloadAndSave(url, filePath);
        } catch (e) {
            logger.error("Beautitab: Failed to save image to cache", e);
            return null;
        }
    }

    async getResourcePath(filePath: string): Promise<string> {
        return this.plugin.app.vault.adapter.getResourcePath(filePath);
    }

    async exists(filePath: string): Promise<boolean> {
        if (!filePath) return false;

        if (filePath.startsWith("app://")) {
            return this.checkAppProtocolPath(filePath);
        }

        return await this.plugin.app.vault.adapter.exists(normalizePath(filePath));
    }

    async pruneCache(): Promise<void> {
        try {
            const adapter = this.plugin.app.vault.adapter;
            if (!(await adapter.exists(this.cacheDir))) return;

            const files = await this.getCacheFiles();
            const maxAge = MAX_CACHE_AGE_DAYS * ONE_DAY_MS;
            const now = Date.now();

            await this.removeOldFiles(files, now, maxAge);
        } catch (e) {
            logger.error("Beautitab: Error pruning cache", e);
        }
    }

    async clearAll(): Promise<void> {
        try {
            const adapter = this.plugin.app.vault.adapter;
            if (!(await adapter.exists(this.cacheDir))) return;

            const files = await this.getCacheFiles();
            await Promise.all(files.map(file => adapter.remove(file)));
        } catch (e) {
            logger.error("Beautitab: Error clearing cache", e);
        }
    }

    // Private helper methods

    private async isLocalPath(url: string): Promise<boolean> {
        if (url.startsWith("http") || url.startsWith("https://")) return false;
        const adapter = this.plugin.app.vault.adapter;
        return url.startsWith("app://") || await adapter.exists(url);
    }

    private async downloadAndSave(url: string, filePath: string): Promise<string | null> {
        try {
            logger.info("Beautitab: Downloading image", url);
            const response = await requestUrl({ url });
            logger.debug("Beautitab: Download response status", response.status);

            if (response.status !== 200) {
                logger.error("Beautitab: Download failed with status", response.status);
                return null;
            }

            logger.debug("Beautitab: Writing to file", filePath);
            await this.plugin.app.vault.adapter.writeBinary(filePath, response.arrayBuffer);
            logger.info("Beautitab: Successfully saved to cache", filePath);

            return filePath;
        } catch (e) {
            logger.error("Beautitab: Error in downloadAndSave", e);
            return null;
        }
    }

    private checkAppProtocolPath(filePath: string): boolean {
        try {
            const absolutePath = this.extractAbsolutePath(filePath);
            return absolutePath ? fs.existsSync(absolutePath) : false;
        } catch {
            return false;
        }
    }

    private extractAbsolutePath(appUrl: string): string | null {
        const withoutScheme = appUrl.slice("app://".length);
        const firstSlash = withoutScheme.indexOf("/");

        if (firstSlash === -1) return null;

        const rest = withoutScheme.slice(firstSlash + 1);
        return rest.split("?")[0];
    }

    private async getCacheFiles(): Promise<string[]> {
        const result = await this.plugin.app.vault.adapter.list(this.cacheDir);
        return result.files;
    }

    private async removeOldFiles(files: string[], now: number, maxAge: number): Promise<void> {
        const adapter = this.plugin.app.vault.adapter;

        for (const file of files) {
            const stat = await adapter.stat(file);
            if (stat && (now - stat.mtime > maxAge)) {
                await adapter.remove(file);
            }
        }
    }

    private buildDeterministicFilename(url: string, meta?: ImageMeta): string {
        const date = meta?.date ?? new Date();
        const stamp = this.formatHourStamp(date);
        const theme = meta?.theme ? this.sanitizeSegment(meta.theme) : "bg";

        const { idPart, hostPart } = this.extractUrlParts(url);

        if (idPart) {
            return `bg-${stamp}-${theme}-${idPart}.jpg`;
        }

        const hash = this.fnv1a32(url);
        const host = hostPart || "remote";
        return `bg-${stamp}-${theme}-${host}-${hash}.jpg`;
    }

    private extractUrlParts(url: string): { idPart: string; hostPart: string } {
        try {
            const u = new URL(url);
            const hostPart = this.sanitizeSegment(u.hostname);
            const match = u.pathname.match(/\/photo-[^/]+/);
            const idPart = match
                ? this.sanitizeSegment(match[0].replace("/", ""))
                : "";

            return { idPart, hostPart };
        } catch {
            return { idPart: "", hostPart: "" };
        }
    }

    private sanitizeSegment(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9._-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
    }

    private formatHourStamp(date: Date): string {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}_${hh}`;
    }

    private fnv1a32(input: string): string {
        // Use fnv1a library - returns bigint, convert to hex string
        const hash = fnv1a(input, 32);
        return hash.toString(16).padStart(8, "0");
    }
}
