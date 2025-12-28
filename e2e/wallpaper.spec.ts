import { expect, test } from "obsidian-e2e-toolkit";
import path from "node:path";

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
    // @ts-ignore
    const plugin = app.plugins.getPlugin("beautitab");
    if (plugin) {
        plugin.settings.backgroundTheme = "custom";
        plugin.settings.customBackground = "https://images.unsplash.com/photo-1509023464722-18d996393ca8";
        plugin.settings.refreshBackgroundOnHourChange = true;
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

test("wallpaper should persist with refreshBackgroundOnHourChange enabled", async ({ obsidian }) => {
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
    // @ts-ignore
    const plugin = app.plugins.getPlugin("beautitab");
    if (plugin) {
        plugin.settings.backgroundTheme = "custom";
        plugin.settings.customBackground = "https://images.unsplash.com/photo-1545569341-9eb8b30979d9";
        plugin.settings.refreshBackgroundOnHourChange = true;
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

test("wallpaper should refresh on hour change", async ({ obsidian, page }) => {
  // Increase timeout for this specific test
  test.setTimeout(120000);
  
  console.log("!!! TEST START: wallpaper should refresh on hour change !!!");
  
  // Listen for console logs
  obsidian.page.on("console", msg => console.log(`BROWSER [${msg.type().toUpperCase()}]: ${msg.text()}`));

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

    // Configure settings: enable hour-based refresh and set custom background
    const bgUrl1 = "https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=1192&auto=format&fit=crop";
    console.log("Configuring settings with initial URL:", bgUrl1);
    await obsidian.page.evaluate(async (url) => {
      // @ts-ignore
      const plugin = app.plugins.getPlugin("beautitab");
      if (plugin) {
          plugin.settings.backgroundTheme = "custom";
          plugin.settings.customBackground = url;
          plugin.settings.refreshBackgroundOnHourChange = true;
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

    // Update custom background URL to simulate what would happen if Unsplash returned a new image
    const bgUrl2 = "https://plus.unsplash.com/premium_photo-1666700698946-fbf7baa0134a?q=80&w=736&auto=format&fit=crop";
    console.log("Updating custom background to new URL:", bgUrl2);
    await obsidian.page.evaluate(async (url) => {
      // @ts-ignore
      const plugin = app.plugins.getPlugin("beautitab");
      if (plugin) {
          plugin.settings.customBackground = url;
          await plugin.saveSettings();
          console.log("New background URL saved to settings.");
      }
    }, bgUrl2);

    console.log("Advancing clock by 61 minutes to trigger refresh check...");
    await page.clock.setFixedTime(new Date(now.getTime() + 61 * 60 * 1000));
    
    // The hook checks every 30 seconds. We advanced the clock, so it should trigger quickly now.
    console.log("Waiting 45s for refresh poll and fetch...");
    await obsidian.page.waitForTimeout(45000);

    const bg2 = await getBg();
    console.log("Updated BG:", bg2);

    expect(bg2, "Background should have changed after the hour update").not.toBe(bg1);
    expect(bg2, "Updated background should still be a URL").toContain("url(");
    console.log("!!! TEST SUCCESS !!!");
  } catch (err) {
    console.error("!!! TEST FAILED !!!", err);
    throw err;
  }
});

test("wallpaper should NOT refresh on hour change if disabled", async ({ obsidian, page }) => {
  test.setTimeout(90000);
  
  console.log("!!! TEST START: wallpaper should NOT refresh on hour change if disabled !!!");
  
  const now = new Date("2025-12-28T14:00:00Z");
  await page.clock.setFixedTime(now);

  console.log("Waiting for Obsidian ready...");
  await obsidian.waitReady();

  // Open a new tab to trigger Beautitab
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.save("beautitab-virtual.md", "");

  // Configure settings: DISABLE hour-based refresh
  const bgUrl = "https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=1192&auto=format&fit=crop";
  await obsidian.page.evaluate(async (url) => {
    // @ts-ignore
    const plugin = app.plugins.getPlugin("beautitab");
    if (plugin) {
        plugin.settings.backgroundTheme = "custom";
        plugin.settings.customBackground = url;
        plugin.settings.refreshBackgroundOnHourChange = false; // DISABLED
        plugin.settings.cachedBackground = null;
        await plugin.saveSettings();
    }
  }, bgUrl);

  // Reload
  await obsidian.closeTab();
  await obsidian.command("workspace:new-tab");
  await obsidian.waitForView("beautitab-react-view");
  await obsidian.page.waitForTimeout(5000);

  const getBg = async () => await obsidian.page.evaluate(() => {
    const el = document.querySelector(".beautitab-root") as HTMLElement;
    return el?.style.getPropertyValue("--beautitab-bg-url-current");
  });

  const bg1 = await getBg();
  console.log("Initial BG:", bg1);
  expect(bg1).toContain("url(");

  // Advance clock
  console.log("Advancing clock by 65 minutes...");
  await page.clock.setFixedTime(new Date(now.getTime() + 65 * 60 * 1000));
  
  // Wait to ensure no update triggers
  console.log("Waiting 45s to ensure NO refresh occurs...");
  await obsidian.page.waitForTimeout(45000);

  const bg2 = await getBg();
  console.log("BG after time advance:", bg2);

  expect(bg2, "Background should NOT have changed when refresh is disabled").toBe(bg1);
  console.log("!!! TEST SUCCESS !!!");
});
