import { requestUrl, TAbstractFile } from "obsidian";
import BeautitabPlugin from "main";

const CACHE_FOLDER_NAME = "bg-cache";

export class LocalImageCache {
    plugin: BeautitabPlugin;
    cacheDir: string;

    constructor(plugin: BeautitabPlugin) {
        this.plugin = plugin;
        this.cacheDir = `${this.plugin.manifest.dir}/${CACHE_FOLDER_NAME}`;
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
                return adapter.getResourcePath(url);
            }

            // Generate a filename
            // We can use a hash of the URL or just a timestamp. 
            // Since we want to avoid duplicates if possible, maybe a simple hash?
            // For now, let's use timestamp + random to be safe and simple.
            const filename = `bg-${Date.now()}-${Math.floor(Math.random() * 10000)}.jpg`;
            const filePath = `${this.cacheDir}/${filename}`;

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

    async cleanCache(keepFiles: string[]) {
        try {
            const adapter = this.plugin.app.vault.adapter;
            if (!(await adapter.exists(this.cacheDir))) return;

            const result = await adapter.list(this.cacheDir);
            const files = result.files;
            
            // KeepFiles might be full resource paths or relative paths. 
            // We need to be careful matching them.
            // Let's assume keepFiles contains the resource paths we are currently using.
            
            for (const file of files) {
                const resourcePath = adapter.getResourcePath(file);
                // If the file is not in the keep list, delete it.
                // We should probably also check if it's very new (to avoid race conditions)
                // But for now, let's just delete if not in keepFiles.
                
                // Actually, passing keepFiles is tricky because resource paths might change? 
                // No, they are usually stable for a session.
                
                // Better strategy: Delete files older than X days? 
                // Or just keep the last N files?
                
                // Let's just delete files that are not in the queue and not the current background.
                // But the queue is in localStorage, so we can pass the list of "active" URLs.
                
                const isKept = keepFiles.some(k => k.includes(file)); // Simple check
                if (!isKept) {
                    await adapter.remove(file);
                }
            }
        } catch (e) {
            console.error("Beautitab: Error cleaning cache", e);
        }
    }
}
