import { requestUrl, TAbstractFile, normalizePath } from "obsidian";
import BeautitabPlugin from "main";

const CACHE_FOLDER_NAME = "bg-cache";

export class LocalImageCache {
    plugin: BeautitabPlugin;
    cacheDir: string;

    constructor(plugin: BeautitabPlugin) {
        this.plugin = plugin;
        this.cacheDir = normalizePath(`${this.plugin.manifest.dir}/${CACHE_FOLDER_NAME}`);
    }

    async init() {
        const adapter = this.plugin.app.vault.adapter;
        if (!(await adapter.exists(this.cacheDir))) {
            await adapter.mkdir(this.cacheDir);
        }
    }

    async saveImage(url: string): Promise<string | null> {
        try {
            const adapter = this.plugin.app.vault.adapter;
            await this.init();

            // Check if it's already a local path
            if (url.startsWith("app://") || await adapter.exists(url)) {
                // If it exists, return the path (not the resource path, to be consistent)
                return url;
            }

            // Generate a filename
            const filename = `bg-${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
            const filePath = normalizePath(`${this.cacheDir}/${filename}`);

            const response = await requestUrl({ url });
            if (response.status !== 200) return null;

            await adapter.writeBinary(filePath, response.arrayBuffer);
            
            return filePath;
        } catch (e) {
            console.error("Beautitab: Failed to save image to cache", e);
            return null;
        }
    }
    
    async getResourcePath(filePath: string): Promise<string> {
        return this.plugin.app.vault.adapter.getResourcePath(filePath);
    }

    async exists(filePath: string): Promise<boolean> {
        if (!filePath) return false;
        // app:// プロトコルが含まれている場合は、実パスを取り出す
        let path = filePath;
        if (filePath.startsWith("app://")) {
            // app://<id>/<path> の形式からパス部分を抽出するのは難しいため、
            // 基本的に保存時は相対パスで管理し、表示直前に resolve する運用にします。
            return true; 
        }
        return await this.plugin.app.vault.adapter.exists(normalizePath(path));
    }

    async pruneCache() {
        try {
            const adapter = this.plugin.app.vault.adapter;
            if (!(await adapter.exists(this.cacheDir))) return;

            const result = await adapter.list(this.cacheDir);
            const files = result.files;
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;
            const MAX_AGE = 3 * ONE_DAY; // Keep for 3 days

            for (const file of files) {
                const stat = await adapter.stat(file);
                if (stat && (now - stat.mtime > MAX_AGE)) {
                    await adapter.remove(file);
                }
            }
        } catch (e) {
            console.error("Beautitab: Error pruning cache", e);
        }
    }
}
