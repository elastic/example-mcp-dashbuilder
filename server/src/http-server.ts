/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License 2.0;
 * you may not use this file except in compliance with the Elastic License 2.0.
 */

import type { Express } from 'express';
import type { Server } from 'http';

/**
 * Try to listen on the given port. When `EADDRINUSE` is encountered and no
 * explicit PORT env var was set, falls back to port 0 (OS-assigned). When an
 * explicit PORT was requested and is busy, logs an error and exits.
 */
export function tryListen(
  app: Express,
  port: number,
  host: string,
  options: { explicitPort: boolean }
): Promise<Server> {
  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, () => resolve(httpServer));
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && port !== 0 && !options.explicitPort) {
        // No explicit PORT set and default port is busy — let the OS pick one
        resolve(tryListen(app, 0, host, options));
      } else if (err.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${port} is already in use. Set a different port with the PORT environment variable.`
          )
        );
      } else {
        reject(err);
      }
    });
  });
}

/** Parse whether `--http` flag is present in the given argv array. */
export function parseHttpFlag(argv: string[]): boolean {
  return argv.includes('--http');
}
