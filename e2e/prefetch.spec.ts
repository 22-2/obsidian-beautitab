import { expect, test } from "obsidian-e2e-toolkit";
import path from "node:path";

const UNSPLASH_API_KEY = process.env.UNSPLASH_API_KEY || "";

test.use({
  vaultOptions: {
    enableBrowserConsoleLogging: true,
    logLevel: "info",
    plugins: [
      {
        path: path.resolve("./dist"),
        pluginId: "beautitab",
      },
    ],
  },
});

test("prefetch should update settings cache with local path", async ({ obsidian, page }) => {
  test.setTimeout(120000);

  if (!UNSPLASH_API_KEY) {
    console.log("Skipping test: UNSPLASH_API_KEY not set");
    test.skip();
    return;
  }

  // Listen for console logs
  obsidian.page.on("console", msg => console.log(`BROWSER [${msg.type().toUpperCase()}]: ${msg.text()}`));
  obsidian.page.on("pageerror", err => console.log(`BROWSER [ERROR]: ${err.message}`));


  // Set time to X:00
  const now = new Date("2025-12-28T14:00:00Z");
  await page.clock.setFixedTime(now);

  console.log("Waiting for Obsidian ready...");
  await obsidian.waitReady();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.save("beautitab-virtual.md", "");

  // Configure settings
  await obsidian.page.evaluate(async (apiKey) => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.backgroundTheme = "seasons and holidays";
        plugin.settings.apiKey = apiKey;
        plugin.settings.cachedBackground = null;
        await plugin.saveSettings();
    }
  }, UNSPLASH_API_KEY);

  // Reload to ensure settings active
  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");

  console.log("Waiting for prefetch...");
  // Prefetch runs after component invalidation or mounting, usually checks if next hour is needed
  // We need to wait enough time for the prefetch request to finish AND image to be downloaded
  await obsidian.page.waitForTimeout(15000);

  // Check the settings to see if the cache entry for NEXT hour has a local path
  const cacheCheck = await obsidian.page.evaluate(() => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    const cache = plugin.settings.backgroundCache || {};
    
    // Find any item for 15:00
    let nextHourItem = null;
    let cacheKey = "";
    
    for (const [key, entry] of Object.entries(cache) as any) {
        if (entry.items) {
            for (const item of entry.items) {
                const date = new Date(item.date);
                if (date.getHours() === 15) { // 14:00 + 1 = 15:00
                    nextHourItem = item;
                    cacheKey = key;
                    break;
                }
            }
        }
        if (nextHourItem) break;
    }
    
    return {
        found: !!nextHourItem,
        url: nextHourItem ? nextHourItem.url : null,
        isLocal: nextHourItem ? nextHourItem.url.startsWith("app://") || nextHourItem.url.startsWith("data:") : false
    };
  });

  console.log("Cache check result:", cacheCheck);
  
  if (!cacheCheck.found) {
    const fullCache = await obsidian.page.evaluate(() => {
        const plugin = app.plugins.getPlugin("beautitab") as any;
        return plugin.settings.backgroundCache;
    });
    console.log("Full cache dump:", JSON.stringify(fullCache, null, 2));
  } else if (!cacheCheck.isLocal) {
    console.log("Item found but not local. URL:", cacheCheck.url);
  }

  expect(cacheCheck.found).toBe(true);
  
  // This expectation fails currently, as the URL remains HTTP
  expect(cacheCheck.url).not.toMatch(/^https?:\/\//);
  expect(cacheCheck.isLocal).toBe(true);
});
