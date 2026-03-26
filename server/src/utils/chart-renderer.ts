import puppeteer, { type Browser } from 'puppeteer';

const PREVIEW_URL = process.env.PREVIEW_URL || 'http://localhost:5173';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
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

    await page.setViewport({ width: 650, height: 420 });
    await page.goto(`${PREVIEW_URL}?render=${encodeURIComponent(chartId)}`, {
      waitUntil: 'networkidle0',
      timeout: 10000,
    });

    // Wait for the chart to be rendered — Elastic Charts renders async
    await page.waitForSelector('#render-ready[data-status="ok"]', { timeout: 5000 });

    // Give Elastic Charts a moment to finish its animations
    await new Promise((r) => setTimeout(r, 500));

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
  if (browser) {
    await browser.close();
    browser = null;
  }
}
