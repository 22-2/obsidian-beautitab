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
  await page.clock.install({ time: now });

  console.log("Waiting for Obsidian ready...");
  await obsidian.waitReady();

  // Mock Unsplash API to prevent network hangs with mocked clock
  // and to ensure deterministic testing without using up API quota
  await page.route("**/photos/random**", async route => {
      console.log("Intercepted Unsplash API request, returning mock");
      await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{
              id: "mock-id",
              urls: {
                  raw: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba", // A valid Unsplash image
                  full: "https://images.unsplash.com/photo-1682687220742-aba13b6e50ba"
              },
              links: {
                  download_location: "https://api.unsplash.com/photos/mock-id/download"
              },
              user: {
                  name: "Mock User",
                  links: { html: "https://unsplash.com/@mockuser" }
              }
          }])
      });
  });

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

  // Ensure we trigger a fetch if one isn't happening, or wait for the existing one
  await obsidian.page.evaluate(async () => {
     const plugin = app.plugins.getPlugin("beautitab") as any;
     if (!plugin.prefetchManager) return;
     
     // If not fetching, trigger it. If fetching, we'll just wait.
     if (!plugin.prefetchManager.isFetching) {
         console.log("Triggering checkAndPrefetch manually");
         // Do not await this, so we can control time in the loop below
         plugin.prefetchManager.checkAndPrefetch(); 
     } else {
         console.log("Already fetching, will wait for completion");
     }
  });

  // Poll until isFetching is false
  // We need to advance the clock to let the fetch timeouts/intervals fire
  console.log("Waiting for fetch to complete...");
  for (let i = 0; i < 30; i++) { // Try for 30 iterations
      const stillFetching = await obsidian.page.evaluate(() => {
          const plugin = app.plugins.getPlugin("beautitab") as any;
          return plugin.prefetchManager && plugin.prefetchManager.isFetching;
      });
      
      if (!stillFetching) {
          console.log("Fetch completed!");
          break;
      }
      
      // Advance virtual time to process timers
      await page.clock.fastForward(1000); 
      // Real wait to let JS event loop flush
      await obsidian.page.waitForTimeout(200); 
  }
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
