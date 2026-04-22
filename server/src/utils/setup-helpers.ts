/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

/**
 * Masks a sensitive value for display, showing only the last 4 characters.
 */
export function maskValue(value: string): string {
  if (value.length < 12) return '****';
  return '****' + value.slice(-4);
}

/**
 * Builds a prompt string, optionally masking the default value.
 */
export function buildPrompt(question: string, defaultValue?: string, sensitive?: boolean): string {
  const displayDefault = defaultValue && sensitive ? maskValue(defaultValue) : defaultValue;
  return displayDefault ? `${question} [${displayDefault}]: ` : `${question}: `;
}
