#!/usr/bin/env bun
// CLI entry point for NWC Monitor

import { resolve } from 'path';
import { existsSync } from 'fs';
import { loadConfig } from './config';
import { NWCMonitor } from './monitor';
import { logger } from './utils/logger';

const VERSION = '0.1.0';

/**
 * Parse CLI arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string | boolean> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--config' || arg === '-c') {
      options.config = args[++i];
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }
  
  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
nwc-monitor v${VERSION}

Monitor NWC (Nostr Wallet Connect) payments with pluggable actions.

USAGE:
  nwc-monitor [OPTIONS]

OPTIONS:
  -c, --config <path>    Path to YAML config file (default: ./config/default.yml)
  --verbose              Enable verbose debug logging
  -v, --version          Show version
  -h, --help             Show this help

EXAMPLES:
  # Use default config
  nwc-monitor

  # Use custom config
  nwc-monitor --config ~/my-config.yml

  # Enable verbose logging
  nwc-monitor --verbose

CONFIG:
  See config/default.yml for a full example configuration.
  Supports both single-wallet and multi-wallet setups.

DOCUMENTATION:
  https://github.com/claudiomolt/nwc-monitor
`);
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();
  
  // Show help
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  // Show version
  if (options.version) {
    console.log(`nwc-monitor v${VERSION}`);
    process.exit(0);
  }
  
  // Enable verbose logging
  if (options.verbose) {
    logger.setVerbose(true);
  }
  
  // Find config file
  const configPath = options.config as string || './config/default.yml';
  const resolvedPath = resolve(configPath);
  
  if (!existsSync(resolvedPath)) {
    console.error(`Config file not found: ${resolvedPath}`);
    console.error('Run with --help for usage information');
    process.exit(1);
  }
  
  try {
    // Load config
    logger.info(`Loading config from ${resolvedPath}...`);
    const config = await loadConfig(resolvedPath);
    
    // Create and start monitor
    const monitor = new NWCMonitor(config.wallets!, config.monitor);
    
    // Handle graceful shutdown
    const shutdown = async () => {
      logger.info('\nShutdown signal received...');
      await monitor.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    // Start monitoring
    await monitor.start();
    
    // Keep process alive
    logger.info('Monitoring payments... Press Ctrl+C to stop');
    
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };
