import { chromium, devices, BrowserContextOptions, Browser, Response } from "playwright";
import { SearchResponse, SearchResult, CommandOptions } from "./types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import logger from "./logger.js";

// Fingerprint configuration interface
interface FingerprintConfig {
  deviceName: string;
  locale: string;
  timezoneId: string;
  colorScheme: "dark" | "light";
  reducedMotion: "reduce" | "no-preference";
  forcedColors: "active" | "none";
}

// Interface for saved state file
interface SavedState {
  fingerprint?: FingerprintConfig;
  googleDomain?: string;
}

/**
 * Get the actual configuration of the host machine
 * @param userLocale User-specified locale (if any)
 * @returns Fingerprint config based on host machine
 */
function getHostMachineConfig(userLocale?: string): FingerprintConfig {
  // Get system locale
  const systemLocale = userLocale || process.env.LANG || "zh-CN";

  // Get system timezone
  // Node.js does not provide timezone info directly, but can infer from offset
  const timezoneOffset = new Date().getTimezoneOffset();
  let timezoneId = "Asia/Shanghai"; // Default to Shanghai

  // Roughly infer timezone from offset (minutes from UTC, negative means east)
  if (timezoneOffset <= -480 && timezoneOffset > -600) {
    // UTC+8 (China, Singapore, Hong Kong, etc.)
    timezoneId = "Asia/Shanghai";
  } else if (timezoneOffset <= -540) {
    // UTC+9 (Japan, Korea, etc.)
    timezoneId = "Asia/Tokyo";
  } else if (timezoneOffset <= -420 && timezoneOffset > -480) {
    // UTC+7 (Thailand, Vietnam, etc.)
    timezoneId = "Asia/Bangkok";
  } else if (timezoneOffset <= 0 && timezoneOffset > -60) {
    // UTC+0 (UK, etc.)
    timezoneId = "Europe/London";
  } else if (timezoneOffset <= 60 && timezoneOffset > 0) {
    // UTC-1 (some European regions)
    timezoneId = "Europe/Berlin";
  } else if (timezoneOffset <= 300 && timezoneOffset > 240) {
    // UTC-5 (US East)
    timezoneId = "America/New_York";
  }

  // Detect system color scheme
  const hour = new Date().getHours();
  const colorScheme =
    hour >= 19 || hour < 7 ? ("dark" as const) : ("light" as const);

  // Other settings use reasonable defaults
  const reducedMotion = "no-preference" as const;
  const forcedColors = "none" as const;

  // Always use Chrome as device name
  const deviceName = "Desktop Chrome";

  return {
    deviceName,
    locale: systemLocale,
    timezoneId,
    colorScheme,
    reducedMotion,
    forcedColors,
  };
}

/**
 * Perform Google search and return results
 * @param query Search keywords
 * @param options Search options
 * @returns Search results
 */
export async function googleSearch(
  query: string,
  options: CommandOptions = {},
  existingBrowser?: Browser
): Promise<SearchResponse> {
  // Set default options
  const {
    limit = 10,
    timeout = 60000,
    stateFile = path.join(os.homedir(), ".google-search-browser-state.json"),
    noSaveState = false,
    locale = "zh-CN", // Default to Chinese
    region = "cn", // Default to China region
  } = options;

  // State file paths
  const stateFilePath = path.resolve(stateFile);
  const fingerprintFilePath = stateFilePath.replace(
    ".json",
    "-fingerprint.json"
  );

  // Load saved state
  let savedState: SavedState = {};
  let fingerprint: FingerprintConfig = getHostMachineConfig(locale);

  // Try to load fingerprint config
  try {
    if (fs.existsSync(fingerprintFilePath)) {
      const fingerprintData = fs.readFileSync(fingerprintFilePath, "utf-8");
      fingerprint = JSON.parse(fingerprintData);
      logger.info("Loaded browser fingerprint config");
    } else {
      // Save newly generated fingerprint config
      fs.writeFileSync(
        fingerprintFilePath,
        JSON.stringify(fingerprint, null, 2)
      );
      logger.info("Generated and saved new browser fingerprint config");
    }
  } catch (error) {
    logger.warn("Error loading or saving browser fingerprint config, using default");
  }

  // Try to load saved state
  try {
    if (fs.existsSync(stateFilePath)) {
      const stateData = fs.readFileSync(stateFilePath, "utf-8");
      savedState = JSON.parse(stateData);
      logger.info("Loaded saved state");
    }
  } catch (error) {
    logger.warn("Error loading saved state, will use new session");
  }

  // Get Google domain
  const googleDomain = savedState.googleDomain || `www.google.${region}`;

  // Ignore passed headless param, always start in headless mode
  let useHeadless = true;

  logger.info({ options }, "Initializing browser...");

  // Check if state file exists
  let storageState: string | undefined = undefined;

  if (fs.existsSync(stateFilePath)) {
    logger.info(
      { stateFile },
      "Found browser state file, will use saved state to avoid bot detection"
    );
    storageState = stateFilePath;
  } else {
    logger.info(
      { stateFile },
      "No browser state file found, will create new session and fingerprint"
    );
  }

  // Get random delay
  const getRandomDelay = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // Function to perform search, reusable for headless and headed mode
  async function performSearch(headless: boolean): Promise<SearchResponse> {
    let browser: Browser;
    let browserWasProvided = false;

    if (existingBrowser) {
      browser = existingBrowser;
      browserWasProvided = true;
      logger.info("Using existing browser instance");
    } else {
      logger.info(
        { headless },
        `Preparing to launch browser in ${headless ? "headless" : "headed"} mode...`
      );

      // Initialize browser, add more args to avoid detection
      browser = await chromium.launch({
        headless,
        timeout: timeout * 2, // Increase browser launch timeout
        args: [
          "--disable-blink-features=AutomationControlled",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-site-isolation-trials",
          "--disable-web-security",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--hide-scrollbars",
          "--mute-audio",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-component-extensions-with-background-pages",
          "--disable-extensions",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--disable-renderer-backgrounding",
          "--enable-features=NetworkService,NetworkServiceInProcess",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
        ],
        ignoreDefaultArgs: ["--enable-automation"],
      });

      logger.info("Browser launched successfully!");
    }

    // Use unified Chrome device config
    const deviceConfig = devices["Desktop Chrome"];

    // Create browser context options
    let contextOptions: BrowserContextOptions = {
      ...deviceConfig,
    };

    // Use saved fingerprint config if available, else use host settings
    if (savedState.fingerprint) {
      contextOptions = {
        ...contextOptions,
        locale: savedState.fingerprint.locale,
        timezoneId: savedState.fingerprint.timezoneId,
        colorScheme: savedState.fingerprint.colorScheme,
        reducedMotion: savedState.fingerprint.reducedMotion,
        forcedColors: savedState.fingerprint.forcedColors,
      };
      logger.info("Using saved browser fingerprint config");
    } else {
      // Get host machine settings
      const hostConfig = getHostMachineConfig(locale);

      contextOptions = {
        ...contextOptions,
        locale: hostConfig.locale,
        timezoneId: hostConfig.timezoneId,
        colorScheme: hostConfig.colorScheme,
        reducedMotion: hostConfig.reducedMotion,
        forcedColors: hostConfig.forcedColors,
      };

      // Save newly generated fingerprint config
      savedState.fingerprint = hostConfig;
      logger.info(
        {
          locale: hostConfig.locale,
          timezone: hostConfig.timezoneId,
          colorScheme: hostConfig.colorScheme,
          deviceType: hostConfig.deviceName,
        },
        "Generated new browser fingerprint config from host machine"
      );
    }

    // Add general options - ensure desktop config
    contextOptions = {
      ...contextOptions,
      permissions: ["geolocation", "notifications"],
      acceptDownloads: true,
      isMobile: false, // Force desktop mode
      hasTouch: false, // Disable touch
      javaScriptEnabled: true,
    };

    if (storageState) {
      logger.info("Loading saved browser state...");
    }

    const context = await browser.newContext(
      storageState ? { ...contextOptions, storageState } : contextOptions
    );

    // Set extra browser properties to avoid detection
    await context.addInitScript(() => {
      // Override navigator properties
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en", "zh-CN"],
      });

      // Override window properties
      // @ts-ignore - ignore chrome property not existing
      window.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };

      // Add WebGL fingerprint randomization
      if (typeof WebGLRenderingContext !== "undefined") {
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (
          parameter: number
        ) {
          // Randomize UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL
          if (parameter === 37445) {
            return "Intel Inc.";
          }
          if (parameter === 37446) {
            return "Intel Iris OpenGL Engine";
          }
          return getParameter.call(this, parameter);
        };
      }
    });

    const page = await context.newPage();

    // Set extra page properties
    await page.addInitScript(() => {
      // Simulate real screen size and color depth
      Object.defineProperty(window.screen, "width", { get: () => 1920 });
      Object.defineProperty(window.screen, "height", { get: () => 1080 });
      Object.defineProperty(window.screen, "colorDepth", { get: () => 24 });
      Object.defineProperty(window.screen, "pixelDepth", { get: () => 24 });
    });

    try {
      logger.info("Visiting Google search page...");

      // Always use www.google.com as domain
      const selectedDomain = "www.google.com";
      // Save selected domain
      savedState.googleDomain = selectedDomain;

      // Build search URL
      const searchUrl = `https://${selectedDomain}/search?q=${encodeURIComponent(
        query
      )}&hl=${locale}`;

      logger.info({ url: searchUrl, query, locale }, "Visiting Google search page");

      // Try to visit Google search page, with retry mechanism
      let response: Response | null = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          // Visit Google search page
          response = await page.goto(searchUrl, {
            timeout: timeout * 2, // Increase timeout
            waitUntil: "domcontentloaded", // Use domcontentloaded instead of networkidle
          });
          
          // If page loaded successfully, break loop
          if (response && response.ok()) {
            logger.info("Page loaded successfully");
            break;
          }
          
          logger.warn({ 
            status: response?.status(), 
            url: response?.url(),
            retry: retryCount + 1
          }, "Page not loaded successfully, retrying");
          
          // Wait before retry
          await page.waitForTimeout(2000);
          retryCount++;
        } catch (error) {
          logger.error({ error: error instanceof Error ? error.message : String(error), retry: retryCount + 1 }, "Error loading page");
          
          // Wait before retry
          await page.waitForTimeout(2000);
          retryCount++;
        }
      }

      // If all retries failed, throw error
      if (retryCount >= maxRetries && (!response || !response.ok())) {
        throw new Error(`Unable to load Google search page after ${maxRetries} retries`);
      }

      // Check if redirected to CAPTCHA page
      const currentUrl = page.url();
      logger.info({ currentUrl }, "Current page URL");

      const sorryPatterns = [
        "google.com/sorry/index",
        "google.com/sorry",
        "recaptcha",
        "captcha",
        "unusual traffic",
      ];

      const isBlockedPage = sorryPatterns.some(
        (pattern) =>
          currentUrl.includes(pattern) ||
          (response && response.url().includes(pattern))
      );

      if (isBlockedPage) {
        logger.warn("Detected CAPTCHA page");
        if (headless) {
          // In headless mode, retry in headed mode
          await page.close();
          await context.close();
          if (!browserWasProvided) {
            await browser.close();
            return performSearch(false); // Retry in headed mode
          }
          throw new Error("Detected CAPTCHA page, try headed mode or manual verification");
        } else {
          logger.warn("Please complete verification in browser...");
          throw new Error("Detected CAPTCHA page, manual verification required");
        }
      }

      // Check if already on search result page
      const isSearchResultPage = currentUrl.includes("/search") && currentUrl.includes("q=");
      
      // If already on search result page, skip entering query
      if (isSearchResultPage) {
        logger.info({ currentUrl }, "Already on search result page, skipping query input");
      } else {
        logger.info({ query }, "Entering search query");

        // Wait for search box - try multiple selectors
        const searchInputSelectors = [
          "textarea[name='q']",
          "input[name='q']",
          "textarea[title='Search']",
          "input[title='Search']",
          "textarea[aria-label='Search']",
          "input[aria-label='Search']",
          "textarea[aria-label='搜索']",
          "input[aria-label='搜索']",
          "#search-box",
          "#searchform input",
          "#searchbox",
          ".gLFyf",
          "textarea",
          "input[type='text']"
        ];

        // Try waiting for search box
        try {
          const selector = searchInputSelectors.join(',');
          logger.debug({ selector }, "Waiting for search box selector");
          // Use shorter timeout to avoid long wait
          await page.waitForSelector(selector, { timeout: 10000 });
          logger.info({ selector }, "Search box appeared");
        } catch (error) {
          // Handle error as unknown type
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn({ error: errorMessage }, "Timeout waiting for search box, will try direct search");
        }

        let searchInput = null;
        for (const selector of searchInputSelectors) {
          logger.debug({ selector }, "Trying to find search box");
          searchInput = await page.$(selector);
          if (searchInput) {
            logger.info({ selector }, "Found search box");
            break;
          }
          logger.debug({ selector }, "Search box not found");
        }

        if (!searchInput) {
          // Analyze page content
          logger.info("Analyzing page content for issues...");
          
          // Get page title
          const title = await page.title();
          logger.info({ title }, "Page title");
          
          // Check for specific text in page
          const pageContent = await page.content();
          const containsRecaptcha = pageContent.includes("recaptcha") || pageContent.includes("captcha");
          const containsRobot = pageContent.includes("robot") || pageContent.includes("automated");
          const containsError = pageContent.includes("error") || pageContent.includes("sorry");
          
          logger.info({ 
            containsRecaptcha, 
            containsRobot, 
            containsError,
            url: page.url()
          }, "Page content analysis");
          
          // Get all visible input elements
          const inputElements = await page.$$eval('input, textarea', elements => {
            return elements.map(el => ({
              type: el.tagName,
              id: el.id,
              name: (el as HTMLInputElement | HTMLTextAreaElement).name || '',
              class: el.className,
              placeholder: (el as HTMLInputElement | HTMLTextAreaElement).placeholder || '',
              visible: (el as HTMLElement).offsetWidth > 0 && (el as HTMLElement).offsetHeight > 0
            }));
          });
          
          logger.info({ inputElements }, "Input elements on page");

          // Save screenshot for debugging
          const screenshotPath = path.join(os.tmpdir(), `google-search-error-${Date.now()}.png`);
          try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
            logger.error({ screenshotPath }, "Saved page screenshot");
          } catch (screenshotError) {
            logger.error({ error: screenshotError }, "Failed to save screenshot");
          }
          
          // Save page HTML for debugging
          const htmlPath = path.join(os.tmpdir(), `google-search-error-${Date.now()}.html`);
          try {
            const html = await page.content();
            fs.writeFileSync(htmlPath, html);
            logger.error({ htmlPath }, "Saved page HTML");
          } catch (htmlError) {
            logger.error({ error: htmlError }, "Failed to save HTML");
          }
          
          logger.error("Could not find search box");
          throw new Error("Could not find search box");
        }

        // Click search box directly, reduce delay
        await searchInput.click();

        // Type entire query string directly, not char by char
        await page.keyboard.type(query, { delay: getRandomDelay(10, 30) });

        // Reduce delay before pressing enter
        await page.waitForTimeout(getRandomDelay(100, 300));
        await page.keyboard.press("Enter");

        logger.info("Waiting for page to load...");

        // Wait for page to load
        await page.waitForLoadState("domcontentloaded", { timeout });
      }

      logger.info({ url: page.url() }, "Waiting for search results to load...");

      // Wait for search results to load
      try {
        await page.waitForSelector("#search, #rso, .g, [data-sokoban-container], div[role='main']", { 
          timeout: timeout / 2 
        });
        logger.info("Search results loaded");
      } catch (error) {
        logger.error("Could not find search result element");
        throw new Error("Could not find search result element");
      }

      // Reduce wait time
      await page.waitForTimeout(500);

      logger.info("Extracting search results...");

      // Extract search results
      const results = await page.$$eval(
        ".g, [data-sokoban-container] > div",
        (elements, maxResults) => {
          return elements
            .slice(0, maxResults)
            .map((el) => {
              const titleElement = el.querySelector("h3");
              const linkElement = el.querySelector("a");
              const snippetElement = el.querySelector(".VwiC3b, [data-sncf='1']");

              return {
                title: titleElement ? titleElement.textContent || "" : "",
                link: linkElement && linkElement instanceof HTMLAnchorElement
                  ? linkElement.href
                  : "",
                snippet: snippetElement ? snippetElement.textContent || "" : "",
              };
            })
            .filter((item) => item.title && item.link); // Filter out empty results
        },
        limit
      );

      logger.info({ count: results.length }, "Successfully got search results");

      try {
        // Save browser state (unless user specified not to)
        if (!noSaveState) {
          logger.info({ stateFile }, "Saving browser state...");

          // Ensure directory exists
          const stateDir = path.dirname(stateFilePath);
          if (!fs.existsSync(stateDir)) {
            fs.mkdirSync(stateDir, { recursive: true });
          }

          // Save state
          await context.storageState({ path: stateFilePath });
          
          // Save fingerprint config
          fs.writeFileSync(
            fingerprintFilePath,
            JSON.stringify(savedState, null, 2),
            "utf8"
          );
          
          logger.info("Browser state and fingerprint config saved");
        }
      } catch (error) {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, "Error saving state");
      }

      // Close browser (if not externally provided)
      if (!browserWasProvided) {
        await browser.close();
      }

      // Return search results
      return {
        query,
        results,
        language: locale,
        region
      };
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, "Error during search");

      // Try to close resources
      try {
        if (!browserWasProvided && browser) {
          await browser.close();
        }
      } catch (closeError) {
        logger.error({ error: closeError instanceof Error ? closeError.message : String(closeError) }, "Error closing browser");
      }

      // Return error result
      return {
        query,
        results: [
          {
            title: "Search failed",
            link: "",
            snippet: `Unable to complete search, error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        language: locale,
        region,
      };
    }
  }

  // Perform search, return result
  return performSearch(useHeadless);
}
