import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  renameSync,
} from 'fs';
import { resolve, basename } from 'path';
import type { DashboardConfig, PanelConfig, SectionConfig } from '../types.js';
import { PROJECT_ROOT } from './config.js';

const DASHBOARDS_DIR = resolve(PROJECT_ROOT, 'preview', 'public', 'dashboards');
const ACTIVE_PATH = resolve(PROJECT_ROOT, 'preview', 'public', 'dashboard.json');
// Track which dashboard is active
const ACTIVE_ID_PATH = resolve(DASHBOARDS_DIR, '.active');

function ensureDashboardsDir(): void {
  if (!existsSync(DASHBOARDS_DIR)) {
    mkdirSync(DASHBOARDS_DIR, { recursive: true });
  }
}

export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled'
  );
}

function safeDashboardId(id: string): string {
  const sanitized = id.replace(/[^a-z0-9_-]/gi, '');
  if (!sanitized) throw new Error('Invalid dashboard ID');
  return sanitized;
}

function getDashboardPath(id: string): string {
  const safeId = safeDashboardId(id);
  return resolve(DASHBOARDS_DIR, `${safeId}.json`);
}

function getActiveDashboardId(): string {
  ensureDashboardsDir();
  if (existsSync(ACTIVE_ID_PATH)) {
    return readFileSync(ACTIVE_ID_PATH, 'utf-8').trim();
  }
  return 'default';
}

function setActiveDashboardId(id: string): void {
  ensureDashboardsDir();
  writeFileSync(ACTIVE_ID_PATH, id);
}

function emptyDashboard(title = 'Untitled Dashboard'): DashboardConfig {
  return { title, charts: [], sections: [], updatedAt: new Date().toISOString() };
}

function readDashboard(): DashboardConfig {
  const id = getActiveDashboardId();
  const path = getDashboardPath(id);
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    if (!raw.sections) raw.sections = [];
    return raw;
  }
  return emptyDashboard();
}

/** Atomic write — write to temp file then rename to avoid partial reads. */
function atomicWriteSync(filePath: string, data: string): void {
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, filePath);
}

function writeDashboard(config: DashboardConfig): void {
  ensureDashboardsDir();
  config.updatedAt = new Date().toISOString();
  const id = getActiveDashboardId();
  const json = JSON.stringify(config, null, 2);
  atomicWriteSync(getDashboardPath(id), json);
  atomicWriteSync(ACTIVE_PATH, json);
}

// ── Multi-dashboard management ──

export function createDashboard(
  title: string,
  id?: string
): { id: string; dashboard: DashboardConfig } {
  ensureDashboardsDir();
  const dashboardId = id || slugify(title);
  const config = emptyDashboard(title);
  setActiveDashboardId(dashboardId);
  writeDashboard(config);
  return { id: dashboardId, dashboard: config };
}

export function listDashboards(): Array<{
  id: string;
  title: string;
  updatedAt: string;
  isActive: boolean;
}> {
  ensureDashboardsDir();
  const activeId = getActiveDashboardId();
  const files = readdirSync(DASHBOARDS_DIR).filter((f) => f.endsWith('.json'));

  return files.map((file) => {
    const id = basename(file, '.json');
    try {
      const raw = JSON.parse(readFileSync(resolve(DASHBOARDS_DIR, file), 'utf-8'));
      return {
        id,
        title: raw.title || id,
        updatedAt: raw.updatedAt || '',
        isActive: id === activeId,
      };
    } catch {
      return { id, title: id, updatedAt: '', isActive: id === activeId };
    }
  });
}

export function switchDashboard(id: string): DashboardConfig {
  const path = getDashboardPath(id);
  if (!existsSync(path)) {
    throw new Error(`Dashboard "${id}" not found`);
  }
  setActiveDashboardId(id);
  const config = JSON.parse(readFileSync(path, 'utf-8'));
  // Update the active path for the preview app
  writeFileSync(ACTIVE_PATH, JSON.stringify(config, null, 2));
  return config;
}

export function deleteDashboard(id: string): void {
  const path = getDashboardPath(id);
  if (existsSync(path)) {
    unlinkSync(path);
  }
  // If we deleted the active dashboard, switch to another or create default
  if (getActiveDashboardId() === id) {
    const remaining = listDashboards();
    if (remaining.length > 0) {
      switchDashboard(remaining[0].id);
    } else {
      createDashboard('Untitled Dashboard', 'default');
    }
  }
}

// ── Panel/section operations (operate on active dashboard) ──

export function addChart(chart: PanelConfig): DashboardConfig {
  const dashboard = readDashboard();
  const idx = dashboard.charts.findIndex((c) => c.id === chart.id);
  if (idx >= 0) {
    dashboard.charts[idx] = chart;
  } else {
    dashboard.charts.push(chart);
  }
  writeDashboard(dashboard);
  return dashboard;
}

export function removeChart(chartId: string): DashboardConfig {
  const dashboard = readDashboard();
  dashboard.charts = dashboard.charts.filter((c) => c.id !== chartId);
  for (const section of dashboard.sections) {
    section.panelIds = section.panelIds.filter((id) => id !== chartId);
  }
  writeDashboard(dashboard);
  return dashboard;
}

export function setDashboardTitle(title: string): DashboardConfig {
  const dashboard = readDashboard();
  dashboard.title = title;
  writeDashboard(dashboard);
  return dashboard;
}

export function getDashboard(): DashboardConfig {
  return readDashboard();
}

export function clearDashboard(): DashboardConfig {
  const config = emptyDashboard();
  writeDashboard(config);
  return config;
}

export function addSection(section: SectionConfig): DashboardConfig {
  const dashboard = readDashboard();
  const idx = dashboard.sections.findIndex((s) => s.id === section.id);
  if (idx >= 0) {
    dashboard.sections[idx] = section;
  } else {
    dashboard.sections.push(section);
  }
  writeDashboard(dashboard);
  return dashboard;
}

export function removeSection(sectionId: string): DashboardConfig {
  const dashboard = readDashboard();
  dashboard.sections = dashboard.sections.filter((s) => s.id !== sectionId);
  writeDashboard(dashboard);
  return dashboard;
}

export function movePanelToSection(panelId: string, sectionId: string): DashboardConfig {
  const dashboard = readDashboard();
  for (const section of dashboard.sections) {
    section.panelIds = section.panelIds.filter((id) => id !== panelId);
  }
  const target = dashboard.sections.find((s) => s.id === sectionId);
  if (target) {
    target.panelIds.push(panelId);
  }
  writeDashboard(dashboard);
  return dashboard;
}
