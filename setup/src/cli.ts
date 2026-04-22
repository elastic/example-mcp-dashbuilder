#!/usr/bin/env node
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';

import { loadExistingEnv } from './config.js';
import { testConnection } from './connection.js';
import {
  displayBanner,
  displayConfigStatus,
  displayConnectionError,
  displaySummary,
} from './display.js';
import { writeEnvFile } from './env.js';
import { promptForOptions } from './prompts.js';

async function main(): Promise<void> {
  displayBanner();
  displayConfigStatus();

  const existing = loadExistingEnv();
  const config = await promptForOptions(existing);

  // Test the connection
  const spinner = ora('Testing connection...').start();
  try {
    const label = await testConnection(config);
    spinner.succeed(`Connected! (${label})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    spinner.fail('Connection failed');
    displayConnectionError(message);

    const { proceed } = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'Save configuration anyway?',
      initial: false,
    });

    if (!proceed) {
      process.exit(1);
    }
  }

  // Write .env
  const envPath = writeEnvFile(config);
  displaySummary(envPath);
}

main().catch((err) => {
  console.error(chalk.red('Setup failed:'), err.message);
  process.exit(1);
});
