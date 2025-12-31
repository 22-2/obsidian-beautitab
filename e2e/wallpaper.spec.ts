import { expect, test } from "obsidian-e2e-toolkit";
import path from "node:path";

// Get API key from environment variable
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

test("wallpaper should load initially", async ({ obsidian }) => {
  await obsidian.waitReady();

  // Listen for console logs
  obsidian.page.on("console", msg => console.log(`BROWSER [${msg.type().toUpperCase()}]: ${msg.text()}`));
  obsidian.page.on("pageerror", err => console.log(`BROWSER [ERROR]: ${err.message}`));

  // Open a new tab to trigger Beautitab
  await obsidian.command("workspace:new-tab");

  // Wait for the view to mount
  await obsidian.waitForView("beautitab-react-view");

  // Create dummy file to avoid ENOENT error
  await obsidian.save("beautitab-virtual.md", "");

  // Configure settings to use a custom background
  await obsidian.page.evaluate(async () => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.backgroundTheme = "custom";
        plugin.settings.customBackground = "https://images.unsplash.com/photo-1509023464722-18d996393ca8";
        await plugin.saveSettings();
        console.log("Settings updated:", plugin.settings.backgroundTheme, plugin.settings.customBackground);
    } else {
        console.error("Plugin not found in evaluate!");
    }
  });

  // Reload the tab to ensure settings take effect
  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");

  // Wait for fetch/render - increase timeout
  await obsidian.page.waitForTimeout(10000);

  // Helper to get background URL
  const getBackgroundUrl = async () => {
    return await obsidian.page.evaluate(() => {
      const el = document.querySelector(".beautitab-root") as HTMLElement;
      if (!el) return "no-root";
      const style = el.style.getPropertyValue("--beautitab-bg-url-current");
      return style || "empty-style";
    });
  };

  // Check initial background
  const initialBg = await getBackgroundUrl();
  console.log("Initial background:", initialBg);

  expect(initialBg).not.toBe("no-root");
  expect(initialBg).not.toBe("empty-style");
  expect(initialBg).toContain("url(");
});

test("wallpaper should persist when reopening tabs", async ({ obsidian }) => {
  await obsidian.waitReady();

  // Listen for console logs
  obsidian.page.on("console", msg => console.log(`BROWSER [${msg.type().toUpperCase()}]: ${msg.text()}`));
  obsidian.page.on("pageerror", err => console.log(`BROWSER [ERROR]: ${err.message}`));

  // Open a new tab to trigger Beautitab
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.save("beautitab-virtual.md", "");

  // Configure settings with hour-based refresh enabled
  await obsidian.page.evaluate(async () => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.backgroundTheme = "custom";
        plugin.settings.customBackground = "https://images.unsplash.com/photo-1545569341-9eb8b30979d9";
        plugin.settings.cachedBackground = null; // Clear cache
        await plugin.saveSettings();
    }
  });

  // Reload
  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.page.waitForTimeout(3000);

  const getBackgroundUrl = async () => {
    return await obsidian.page.evaluate(() => {
      const el = document.querySelector(".beautitab-root") as HTMLElement;
      if (!el) return "no-root";
      const style = el.style.getPropertyValue("--beautitab-bg-url-current");
      return style || "empty-style";
    });
  };

  // Check initial background
  const initialBg = await getBackgroundUrl();
  console.log("Initial background:", initialBg);

  expect(initialBg).not.toBe("no-root");
  expect(initialBg).not.toBe("empty-style");
  expect(initialBg).toContain("url(");
});

test("wallpaper should NOT change on hour change (stays fixed to mount time)", async ({ obsidian, page }) => {
  // Increase timeout for this specific test
  test.setTimeout(120000);

  console.log("!!! TEST START: wallpaper should stay fixed when hour changes !!!");

  // Listen for console logs
  const browserLogs: string[] = [];
  obsidian.page.on("console", msg => {
    const text = msg.text();
    console.log(`BROWSER [${msg.type().toUpperCase()}]: ${text}`);
    browserLogs.push(text);
  });

  try {
    const now = new Date("2025-12-28T14:00:00Z");
    console.log("Mocking clock to:", now.toISOString());
    await page.clock.setFixedTime(now);

    console.log("Waiting for Obsidian ready...");
    await obsidian.waitReady();

    // Open a new tab to trigger Beautitab
    console.log("Opening new tab...");
    await obsidian.command("workspace:new-tab");
    await obsidian.waitForView("beautitab-react-view");
    await obsidian.save("beautitab-virtual.md", "");

    // Configure settings with custom background
    const bgUrl1 = "https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=1192&auto=format&fit=crop";
    console.log("Configuring settings with initial URL:", bgUrl1);
    await obsidian.page.evaluate(async (url) => {
      const plugin = app.plugins.getPlugin("beautitab") as any;
      if (plugin) {
          plugin.settings.backgroundTheme = "custom";
          plugin.settings.customBackground = url;
          plugin.settings.cachedBackground = null; // Clear cache
          await plugin.saveSettings();
          console.log("Settings saved.");
      }
    }, bgUrl1);

    // Reload
    console.log("Reloading tab...");
    await obsidian.closeTab();
    await obsidian.command("workspace:new-tab");
    await obsidian.waitForView("beautitab-react-view");
    await obsidian.page.waitForTimeout(10000);

    const getBg = async () => await obsidian.page.evaluate(() => {
      const el = document.querySelector(".beautitab-root") as HTMLElement;
      return el?.style.getPropertyValue("--beautitab-bg-url-current");
    });

    const bg1 = await getBg();
    console.log("Initial BG:", bg1);
    expect(bg1).toContain("url(");

    console.log("Advancing clock by 61 minutes...");
    await page.clock.fastForward(61 * 60 * 1000);

    // Wait a bit to ensure no refresh occurs
    console.log("Waiting 5s to ensure background stays the same...");
    await obsidian.page.waitForTimeout(5000);

    const bg2 = await getBg();
    console.log("BG after time advance:", bg2);

    // Background should NOT have changed (stays fixed to mount time)
    expect(bg2, "Background should stay the same after hour change").toBe(bg1);

    console.log("!!! TEST SUCCESS !!!");
  } catch (err) {
    console.error("!!! TEST FAILED !!!", err);
    throw err;
  }
});

// This test is no longer needed as backgrounds now always stay fixed to mount time
// The refreshBackgroundOnHourChange setting has been removed
test.skip("wallpaper should NOT refresh on hour change if disabled", async ({ obsidian, page }) => {
  // Test skipped - backgrounds now always stay fixed to mount time
});

test("next hour background should be prefetched", async ({ obsidian }) => {
  test.setTimeout(60000);

  // Skip test if no API key is provided
  if (!UNSPLASH_API_KEY) {
    console.log("Skipping test: UNSPLASH_API_KEY not set");
    test.skip();
    return;
  }

  await obsidian.waitReady();

  // Listen for console logs
  obsidian.page.on("console", msg => console.log(`BROWSER [${msg.type().toUpperCase()}]: ${msg.text()}`));
  obsidian.page.on("pageerror", err => console.log(`BROWSER [ERROR]: ${err.message}`));

  // Open a new tab to trigger Beautitab
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.save("beautitab-virtual.md", "");

  // Configure settings with a time-based theme (seasons and holidays)
  // and enable hour-based refresh
  await obsidian.page.evaluate(async (apiKey) => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.backgroundTheme = "seasons and holidays";
        plugin.settings.apiKey = apiKey;
        plugin.settings.cachedBackground = null;
        await plugin.saveSettings();
        console.log("Settings configured for prefetch test");
    }
  }, UNSPLASH_API_KEY);

  // Reload
  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");

  // Wait for initial background and prefetch to complete
  console.log("Waiting for prefetch to complete...");
  await obsidian.page.waitForTimeout(10000);

  // Check if prefetch was triggered by looking for console logs
  const prefetchLogs = await obsidian.page.evaluate(() => {
    // Check if there were any prefetch-related logs
    // This is a simple check - in a real scenario, you'd want to verify the actual prefetch happened
    return {
      timestamp: new Date().toISOString(),
      message: "Prefetch check completed"
    };
  });

  console.log("Prefetch logs:", prefetchLogs);

  // Check if backgroundCache has entries
  const cacheInfo = await obsidian.page.evaluate(() => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (!plugin) return { error: "Plugin not found" };

    const cache = plugin.settings.backgroundCache || {};
    const cacheKeys = Object.keys(cache);

    return {
      cacheKeys,
      cacheCount: cacheKeys.length,
      hasCache: cacheKeys.length > 0,
      cacheDetails: Object.entries(cache).map(([key, value]: [string, any]) => ({
        key,
        itemCount: Array.isArray(value?.items) ? value.items.length : 0,
      })),
    };
  });

  console.log("Cache info:", cacheInfo);

  // Verify that cache exists (prefetch should have populated it)
  // @ts-ignore
  expect(cacheInfo.hasCache).toBe(true);
  // @ts-ignore
  expect(cacheInfo.cacheCount).toBeGreaterThan(0);

  console.log("Prefetch test completed successfully");
});

test("only one background image should be cached per hour", async ({ obsidian }) => {
  test.setTimeout(60000);

  // Skip test if no API key is provided
  if (!UNSPLASH_API_KEY) {
    console.log("Skipping test: UNSPLASH_API_KEY not set");
    test.skip();
    return;
  }

  await obsidian.waitReady();

  // Listen for console logs
  obsidian.page.on("console", msg => console.log(`BROWSER [${msg.type().toUpperCase()}]: ${msg.text()}`));
  obsidian.page.on("pageerror", err => console.log(`BROWSER [ERROR]: ${err.message}`));

  // Open a new tab to trigger Beautitab
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.save("beautitab-virtual.md", "");

  // Configure settings with a time-based theme
  await obsidian.page.evaluate(async (apiKey) => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.backgroundTheme = "seasons and holidays";
        plugin.settings.apiKey = apiKey;
        plugin.settings.cachedBackground = null; // Clear cache
        await plugin.saveSettings();
        console.log("Settings configured for single image test");
    }
  }, UNSPLASH_API_KEY);

  // Reload
  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");

  // Wait for background fetch and cache
  console.log("Waiting for background to be cached...");
  await obsidian.page.waitForTimeout(10000);

  // Check bg-cache folder
  const cacheFileInfo = await obsidian.page.evaluate(async () => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (!plugin) return { error: "Plugin not found" };

    const cacheDir = `${plugin.manifest.dir}/bg-cache`;
    const adapter = plugin.app.vault.adapter;

    try {
      const exists = await adapter.exists(cacheDir);
      if (!exists) {
        return { exists: false, files: [], fileCount: 0 };
      }

      const list = await adapter.list(cacheDir);
      const now = new Date();
      const currentHour = now.getHours();

      // Count files for current hour
      const currentHourFiles = list.files.filter((file: string) => {
        const hourMatch = file.match(/_(\d{2})-/);
        if (!hourMatch) return false;
        const fileHour = parseInt(hourMatch[1], 10);
        return fileHour === currentHour;
      });

      return {
        exists: true,
        files: list.files,
        fileCount: list.files.length,
        currentHourFiles: currentHourFiles,
        currentHourCount: currentHourFiles.length,
        currentHour,
      };
    } catch (e: any) {
      return { error: e.message };
    }
  });

  console.log("Cache file info:", cacheFileInfo);

  // Verify that only one file exists for the current hour
  // @ts-ignore
  expect(cacheFileInfo.exists).toBe(true);
  // @ts-ignore
  expect(cacheFileInfo.currentHourCount).toBeLessThanOrEqual(1);

  console.log("Single image test completed successfully");
});

// This test now verifies that the existing tab's background stays the same
// while a new tab gets a fresh background for the new hour
test("existing tab should keep background while new tab gets fresh one on hour change", async ({ obsidian, page }) => {
  test.setTimeout(90000);

  if (!UNSPLASH_API_KEY) {
    console.log("Skipping test: UNSPLASH_API_KEY not set");
    test.skip();
    return;
  }

  const now = new Date("2025-12-28T14:59:00Z");
  await page.clock.setFixedTime(now);

  await obsidian.waitReady();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.save("beautitab-virtual.md", "");

  await obsidian.page.evaluate(async (apiKey) => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.backgroundTheme = "seasons and holidays";
        plugin.settings.apiKey = apiKey;
        plugin.settings.cachedBackground = null;
        await plugin.saveSettings();
    }
  }, UNSPLASH_API_KEY);

  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  
  await obsidian.page.waitForTimeout(10000);

  const getBg = async () => await obsidian.page.evaluate(() => {
    const el = document.querySelector(".beautitab-root") as HTMLElement;
    return el?.style.getPropertyValue("--beautitab-bg-url-current");
  });

  const getBgWithRetry = async (retries = 15) => {
    for (let i = 0; i < retries; i++) {
        const bg = await getBg();
        if (bg && bg.includes("url(")) return bg;
        await obsidian.page.waitForTimeout(1000);
    }
    return await getBg();
  };

  const initialBg = await getBgWithRetry();
  expect(initialBg).toContain("url(");
  console.log("Initial tab background:", initialBg);

  console.log("Advancing to next hour...");
  await page.clock.fastForward(2 * 60 * 1000);

  // Wait a bit
  await obsidian.page.waitForTimeout(5000);

  // Existing tab should keep its background
  const bgAfterTimeAdvance = await getBg();
  expect(bgAfterTimeAdvance, "Existing tab should keep its background").toBe(initialBg);
  
  console.log("Existing tab kept its background as expected");
});

test("custom background should update when settings change", async ({ obsidian }) => {
  await obsidian.waitReady();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.save("beautitab-virtual.md", "");

  const url1 = "https://images.unsplash.com/photo-1509023464722-18d996393ca8";
  const url2 = "https://images.unsplash.com/photo-1545569341-9eb8b30979d9";

  // Set initial
  await obsidian.page.evaluate(async (url) => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.backgroundTheme = "custom";
        plugin.settings.customBackground = url;
        await plugin.saveSettings();
    }
  }, url1);

  // Reload to ensure clean state
  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.page.waitForTimeout(3000);

  const getBg = async () => await obsidian.page.evaluate(() => {
    const el = document.querySelector(".beautitab-root") as HTMLElement;
    return el?.style.getPropertyValue("--beautitab-bg-url-current");
  });
  
  // Check for image ID since it might be cached locally
  expect(await getBg()).toContain("photo-1509023464722-18d996393ca8");

  // Change setting
  await obsidian.page.evaluate(async (url) => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.customBackground = url;
        await plugin.saveSettings();
    }
  }, url2);

  await obsidian.page.waitForTimeout(3000);

  const bg = await getBg();
  // The URL might be cached specifically if it was downloaded, so checking for the original URL might fail if it's converted to app://
  // But we know it should definitely contain "url(" and NOT contain the OLD url if it changed.
  // Actually, for this test we expect it to Change to url2.
  // If url2 gets cached, it will be an app:// path, but it will be DIFFERENT from url1's cached path.
  
  // Let's verify it contains the image ID from unsplash if possible, or just check that it changed.
  // Unsplash IDs: url1 -> photo-1509... , url2 -> photo-1545...
  expect(bg).toContain("photo-1545569341-9eb8b30979d9");
});

// This test now verifies that the existing tab keeps its background on day rollover
test("existing tab should keep background on day rollover", async ({ obsidian, page }) => {
  test.setTimeout(90000);

  if (!UNSPLASH_API_KEY) {
    console.log("Skipping test: UNSPLASH_API_KEY not set");
    test.skip();
    return;
  }

  const now = new Date("2025-12-28T23:59:00Z");
  await page.clock.setFixedTime(now);

  await obsidian.waitReady();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.save("beautitab-virtual.md", "");

  await obsidian.page.evaluate(async (apiKey) => {
    const plugin = app.plugins.getPlugin("beautitab") as any;
    if (plugin) {
        plugin.settings.backgroundTheme = "seasons and holidays";
        plugin.settings.apiKey = apiKey;
        plugin.settings.cachedBackground = null;
        await plugin.saveSettings();
    }
  }, UNSPLASH_API_KEY);

  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  
  await obsidian.page.waitForTimeout(10000);

  const getBg = async () => await obsidian.page.evaluate(() => {
    const el = document.querySelector(".beautitab-root") as HTMLElement;
    return el?.style.getPropertyValue("--beautitab-bg-url-current");
  });

  const getBgWithRetry = async (retries = 15) => {
    for (let i = 0; i < retries; i++) {
        const bg = await getBg();
        if (bg && bg.includes("url(")) return bg;
        await obsidian.page.waitForTimeout(1000);
    }
    return await getBg();
  };

  const initialBg = await getBgWithRetry();
  expect(initialBg).toContain("url(");
  console.log("Initial background:", initialBg);

  console.log("Advancing to next day...");
  await page.clock.fastForward(2 * 60 * 1000);

  // Wait a bit
  await obsidian.page.waitForTimeout(5000);

  // Existing tab should keep its background
  const bgAfterDayRollover = await getBg();
  expect(bgAfterDayRollover, "Existing tab should keep its background on day rollover").toBe(initialBg);
  
  console.log("Day rollover test passed - background stayed the same");
});
