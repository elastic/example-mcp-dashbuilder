import puppeteer, { type Browser } from 'puppeteer';

import { PREVIEW_URL } from './config.js';

const VIEWPORT_WIDTH = 650;
const VIEWPORT_HEIGHT = 420;
const PAGE_LOAD_TIMEOUT_MS = 10_000;
const CHART_RENDER_TIMEOUT_MS = 5_000;
const ANIMATION_SETTLE_MS = 500;
const BROWSER_IDLE_TIMEOUT_MS = 60_000;

let browser: Browser | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (browser) {
      await browser.close().catch(() => {});
      browser = null;
    }
  }, BROWSER_IDLE_TIMEOUT_MS);
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  resetIdleTimer();
  return browser;
}

/**
 * Render a chart to a PNG image by navigating Puppeteer to the preview app
 * with ?render=chartId, waiting for the chart to render, and taking a screenshot.
 *
 * Returns a base64-encoded PNG string, or null if rendering fails.
 */
export async function renderChartToImage(chartId: string): Promise<string | null> {
  let page: Awaited<ReturnType<Browser['newPage']>> | null = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
    await page.goto(`${PREVIEW_URL}?render=${encodeURIComponent(chartId)}`, {
      waitUntil: 'networkidle0',
      timeout: PAGE_LOAD_TIMEOUT_MS,
    });

    // Wait for the chart to be rendered — Elastic Charts renders async
    await page.waitForSelector('#render-ready[data-status="ok"]', {
      timeout: CHART_RENDER_TIMEOUT_MS,
    });

    // Give Elastic Charts a moment to finish its animations
    await new Promise((r) => setTimeout(r, ANIMATION_SETTLE_MS));

    const element = await page.$('#render-ready');
    if (!element) {
      return null;
    }

    const screenshot = await element.screenshot({ type: 'png', encoding: 'base64' });

    return screenshot as string;
  } catch (err) {
    console.error('Chart rendering failed:', err);
    return null;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Close the shared browser instance (call on server shutdown).
 */
export async function closeBrowser(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}
