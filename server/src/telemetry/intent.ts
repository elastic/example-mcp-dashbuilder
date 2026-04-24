/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Coarse usage intent from tool name + arg shapes. No content from user strings.
 */
export function inferIntent(tool: string, args: Record<string, unknown>): string | undefined {
  switch (tool) {
    case 'create_chart': {
      const t = args.chartType;
      return typeof t === 'string' ? `chart:${t}` : 'chart';
    }
    case 'create_metric':
      return 'metric';
    case 'create_heatmap':
      return 'heatmap';
    case 'run_esql': {
      const q = args.query;
      const len = typeof q === 'string' ? q.length : 0;
      return len > 800 ? 'run_esql:large' : 'run_esql';
    }
    case 'app_only_esql_query': {
      const q = args.query;
      const len = typeof q === 'string' ? q.length : 0;
      return len > 800 ? 'app_esql:large' : 'app_esql';
    }
    case 'export_to_kibana':
      return 'kibana:export';
    case 'import_from_kibana':
      return 'kibana:import';
    case 'view_dashboard':
      return 'preview:dashboard';
    case 'export_queries':
      return 'export:queries';
    case 'export_chart_image':
      return 'export:chart_image';
    case 'list_indices':
    case 'get_fields':
      return 'explore:data';
    case 'create_dashboard':
    case 'list_dashboards':
    case 'switch_dashboard':
    case 'delete_dashboard':
    case 'set_dashboard_title':
    case 'remove_chart':
    case 'get_dashboard':
    case 'clear_dashboard':
      return `dashboard:${tool.replace(/_/g, ':')}`;
    case 'create_section':
    case 'move_panel_to_section':
    case 'remove_section':
      return `section:${tool.replace(/_/g, ':')}`;
    case 'app_only_get_dashboard_config':
    case 'app_only_save_panel_layout':
    case 'app_only_detect_time_field':
    case 'app_only_get_chart_preview':
      return `app:${tool.replace('app_only_', '')}`;
    default:
      return undefined;
  }
}
