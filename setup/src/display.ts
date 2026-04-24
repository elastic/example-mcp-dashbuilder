/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import chalk from 'chalk';
import { existsSync } from 'fs';

import { ENV_PATH } from './config.js';

/**
 * Display the setup banner.
 */
export function displayBanner(): void {
  console.log(chalk.bold.blue('\n🚀 MCP Dashboards Setup\n'));
  console.log(chalk.gray('This wizard will configure your Elasticsearch and Kibana connection.\n'));
}

/**
 * Display current .env status.
 */
export function displayConfigStatus(): boolean {
  const envExists = existsSync(ENV_PATH);

  console.log(chalk.bold('📄 Configuration:\n'));
  console.log(
    `  ${envExists ? chalk.green('✓') : chalk.yellow('○')} .env file: ${envExists ? 'exists' : 'not found'}`
  );
  console.log('');

  return envExists;
}

/**
 * Display success summary.
 */
export function displaySummary(envPath: string): void {
  console.log(`\n  Saved to ${envPath}\n`);
}

/**
 * Display a connection test failure and return whether the user wants to save anyway.
 */
export function displayConnectionError(message: string): void {
  console.log(chalk.red(`Failed!\n\n  Error: ${message}\n`));
}
