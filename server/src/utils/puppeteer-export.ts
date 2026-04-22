/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import { readFileSync } from 'fs';
import { MCP_APP_HTML_PATH } from './config.js';

const VIEWPORT_WIDTH = 800;
const CHART_HEIGHT = 400;
const METRIC_HEIGHT = 250;
/** Large single-file MCP bundle can exceed 30s to parse on slow CPUs. */
const SET_CONTENT_TIMEOUT_MS = 120_000;
const RENDER_TIMEOUT_MS = 30_000;
const ANIMATION_SETTLE_MS = 800;

export interface ExportData {
  mode: 'chart-preview';
  chart: Record<string, unknown>;
  data: Record<string, unknown>[];
  trendData?: Record<string, unknown>[];
  colorMode?: 'light' | 'dark';
}

/**
 * Escape JSON so it is safe inside `<script>...</script>` (HTML, not JS, ends the
 * block on a literal `</script>` substring even inside a string).
 */
function escapeJsonForHtmlScript(json: string): string {
  return json.replace(/<\/script/gi, '<\\/script');
}

/**
 * Embed export payload as the first child of `<head>` so it runs before the
 * deferred `type="module"` bundle executes.
 */
function injectExportDataIntoHtml(html: string, exportData: ExportData): string {
  const json = escapeJsonForHtmlScript(JSON.stringify(exportData));
  const boot = `<script>window.__EXPORT_DATA__=${json};<\/script>`;
  return html.replace('<head>', `<head>${boot}`);
}

interface PuppeteerPage {
  setViewport(viewport: { width: number; height: number }): Promise<void>;
  setContent(
    html: string,
    options: { waitUntil: 'domcontentloaded'; timeout: number }
  ): Promise<void>;
  waitForFunction(pageFunction: () => boolean, options: { timeout: number }): Promise<void>;
  screenshot(options: { type: 'png'; encoding: 'base64'; fullPage: true }): Promise<string>;
}

interface PuppeteerBrowser {
  newPage(): Promise<PuppeteerPage>;
  close(): Promise<void>;
}

interface PuppeteerModule {
  default: {
    launch(options: { headless: boolean; args: string[] }): Promise<PuppeteerBrowser>;
  };
}

async function loadPuppeteer(): Promise<PuppeteerModule['default']> {
  const dynamicImport = new Function('specifier', 'return import(specifier);') as (
    specifier: string
  ) => Promise<unknown>;
  const module = (await dynamicImport('puppeteer').catch(() => {
    throw new Error('Puppeteer is not installed. Run: npm install puppeteer --workspace=server');
  })) as PuppeteerModule;
  return module.default;
}

export async function renderChartToPng(exportData: ExportData): Promise<string> {
  const puppeteer = await loadPuppeteer();

  const html = readFileSync(MCP_APP_HTML_PATH, 'utf-8');
  const htmlWithExport = injectExportDataIntoHtml(html, exportData);
  const chartType = (exportData.chart as { chartType?: string }).chartType;
  const height = chartType === 'metric' ? METRIC_HEIGHT : CHART_HEIGHT;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: VIEWPORT_WIDTH, height });

    await page.setContent(htmlWithExport, {
      waitUntil: 'domcontentloaded',
      timeout: SET_CONTENT_TIMEOUT_MS,
    });

    try {
      await page.waitForFunction(
        () => (window as unknown as { __EXPORT_READY__?: boolean }).__EXPORT_READY__ === true,
        { timeout: RENDER_TIMEOUT_MS }
      );
    } catch {
      // Best-effort screenshot even if the readiness flag never flips.
    }

    await new Promise((r) => setTimeout(r, ANIMATION_SETTLE_MS));

    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      fullPage: true,
    });

    return screenshot as string;
  } finally {
    await browser.close();
  }
}
