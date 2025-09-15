#!/usr/bin/env node

/**
 * CTRL FreaQ API Server Entry Point
 *
 * Main application entry point that starts the Express.js server
 * with full middleware stack and core infrastructure.
 */

import { createDevelopmentServer, createProductionServer } from './app.js';

/**
 * Start the appropriate server based on environment
 */
async function main(): Promise<void> {
  const environment = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '5001', 10);

  console.log(`Starting CTRL FreaQ API server in ${environment} mode on port ${port}`);

  try {
    if (environment === 'production') {
      await createProductionServer({ port });
    } else {
      await createDevelopmentServer({ port });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
