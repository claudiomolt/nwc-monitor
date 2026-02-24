#!/usr/bin/env bun
/**
 * NWC Monitor CLI entry point
 */

import { parseArgs } from 'util';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { loadConfig, normalizeConfig } from './config';
import { NWCMonitor } from './monitor';
import { logger, LogLevel } from './utils/logger';
import { registerBuiltinActions } from './actions/index';

const VERSION = '0.1.0';

function showHelp(): void {
  console.log(`
NWC Monitor v${VERSION}
Monitor NWC (Nostr Wallet Connect) payments with pluggable actions

USAGE:
  nwc-monitor [OPTIONS]

OPTIONS:
  -c, --config <path>   Config file path (default: config/default.yml)
  -v, --verbose         Enable verbose logging
  -V, --version         Show version
  -h, --help            Show this help

ARCHITECTURE:
  Primary: Nostr relay subscription (real-time push notifications)
  Fallback: listTransactions polling (startup catch-up, reconnection, sanity checks)

EXAMPLES:
  nwc-monitor
  nwc-monitor --config my-config.yml --verbose

DOCS:
  https://github.com/claudiomolt/nwc-monitor
  `);
}

function showVersion(): void {
  console.log(`nwc-monitor v${VERSION}`);
}

async function main(): Promise<void> {
  try {
    const { values } = parseArgs({
      options: {
        config: { type: 'string', short: 'c', default: 'config/default.yml' },
        verbose: { type: 'boolean', short: 'v', default: false },
        version: { type: 'boolean', short: 'V', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      strict: true,
    });

    if (values.help) {
      showHelp();
      process.exit(0);
    }

    if (values.version) {
      showVersion();
      process.exit(0);
    }

    if (values.verbose) {
      logger.setLevel(LogLevel.DEBUG);
    }

    const configPath = resolve(values.config || 'config/default.yml');
    if (!existsSync(configPath)) {
      logger.error(`Config file not found: ${configPath}`);
      process.exit(1);
    }

    logger.info(`Loading config from: ${configPath}`);
    const config = loadConfig(configPath);

    const wallets = normalizeConfig(config);
    logger.info(`Configured ${wallets.length} wallet(s)`);

    const connectionStrings = new Map<string, string>();
    
    if (config.nwc && !config.wallets) {
      connectionStrings.set('default', config.nwc);
    }
    
    if (config.wallets) {
      for (const wallet of config.wallets) {
        connectionStrings.set(wallet.name, wallet.nwc);
      }
    }

    registerBuiltinActions();

    const monitor = new NWCMonitor(wallets, connectionStrings, config.monitor);

    const shutdown = () => {
      logger.info('Received shutdown signal, stopping monitor...');
      monitor.stop();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await monitor.start();

    logger.info('NWC Monitor running (relay subscription + fallback). Press Ctrl+C to stop.');
  } catch (error) {
    logger.error('Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
