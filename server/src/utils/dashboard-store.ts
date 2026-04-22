/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

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

/** Resolve which dashboard ID to use: explicit override or the global active one. */
function resolveId(dashboardId?: string): string {
  return dashboardId ? safeDashboardId(dashboardId) : getActiveDashboardId();
}

function readDashboard(dashboardId?: string): DashboardConfig {
  const id = resolveId(dashboardId);
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

function writeDashboard(config: DashboardConfig, dashboardId?: string): void {
  ensureDashboardsDir();
  config.updatedAt = new Date().toISOString();
  const id = resolveId(dashboardId);
  const json = JSON.stringify(config, null, 2);
  atomicWriteSync(getDashboardPath(id), json);
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

// ── Panel/section operations ──
// All functions accept an optional `dashboardId` for session isolation.
// When provided, they operate on that specific dashboard without changing
// the global active pointer. When omitted, they use the active dashboard.

export function addChart(chart: PanelConfig, dashboardId?: string): DashboardConfig {
  const dashboard = readDashboard(dashboardId);
  const idx = dashboard.charts.findIndex((c) => c.id === chart.id);
  if (idx >= 0) {
    dashboard.charts[idx] = chart;
  } else {
    dashboard.charts.push(chart);
  }
  writeDashboard(dashboard, dashboardId);
  return dashboard;
}

export function removeChart(chartId: string, dashboardId?: string): DashboardConfig {
  const dashboard = readDashboard(dashboardId);
  dashboard.charts = dashboard.charts.filter((c) => c.id !== chartId);
  for (const section of dashboard.sections) {
    section.panelIds = section.panelIds.filter((id) => id !== chartId);
  }
  writeDashboard(dashboard, dashboardId);
  return dashboard;
}

export function setDashboardTitle(title: string, dashboardId?: string): DashboardConfig {
  const dashboard = readDashboard(dashboardId);
  dashboard.title = title;
  writeDashboard(dashboard, dashboardId);
  return dashboard;
}

export function getDashboard(dashboardId?: string): DashboardConfig {
  return readDashboard(dashboardId);
}

export function clearDashboard(dashboardId?: string): DashboardConfig {
  const config = emptyDashboard();
  writeDashboard(config, dashboardId);
  return config;
}

export function addSection(section: SectionConfig, dashboardId?: string): DashboardConfig {
  const dashboard = readDashboard(dashboardId);
  const idx = dashboard.sections.findIndex((s) => s.id === section.id);
  if (idx >= 0) {
    dashboard.sections[idx] = section;
  } else {
    dashboard.sections.push(section);
  }
  writeDashboard(dashboard, dashboardId);
  return dashboard;
}

export function removeSection(sectionId: string, dashboardId?: string): DashboardConfig {
  const dashboard = readDashboard(dashboardId);
  dashboard.sections = dashboard.sections.filter((s) => s.id !== sectionId);
  writeDashboard(dashboard, dashboardId);
  return dashboard;
}

export function saveDashboardLayout(
  gridLayout: DashboardConfig['gridLayout'],
  dashboardId?: string
): DashboardConfig {
  const dashboard = readDashboard(dashboardId);
  dashboard.gridLayout = gridLayout;
  writeDashboard(dashboard, dashboardId);
  return dashboard;
}

export function saveDashboardTimeRange(
  timeRange: DashboardConfig['timeRange'],
  dashboardId?: string
): DashboardConfig {
  const dashboard = readDashboard(dashboardId);
  dashboard.timeRange = timeRange;
  writeDashboard(dashboard, dashboardId);
  return dashboard;
}

export function movePanelToSection(
  panelId: string,
  sectionId: string,
  dashboardId?: string
): DashboardConfig {
  const dashboard = readDashboard(dashboardId);
  for (const section of dashboard.sections) {
    section.panelIds = section.panelIds.filter((id) => id !== panelId);
  }
  const target = dashboard.sections.find((s) => s.id === sectionId);
  if (target) {
    target.panelIds.push(panelId);
  }
  writeDashboard(dashboard, dashboardId);
  return dashboard;
}
