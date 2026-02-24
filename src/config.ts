/**
 * Configuration loader and validator
 */

import { parse } from 'yaml';
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { AppConfig, WalletConfig } from './types';
import { logger } from './utils/logger';

const DEFAULT_CONFIG_PATH = './config/default.yml';

function expandHome(path: string): string {
  if (path.startsWith('~/')) {
    return resolve(process.env.HOME || '~', path.slice(2));
  }
  return path;
}

export async function loadConfig(configPath?: string): Promise<AppConfig> {
  const path = configPath || DEFAULT_CONFIG_PATH;
  const resolvedPath = resolve(path);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  logger.info(`Loading config from: ${resolvedPath}`);

  const file = Bun.file(resolvedPath);
  const content = await file.text();
  const config = parse(content) as AppConfig;

  // Default monitor settings
  if (!config.monitor) {
    config.monitor = {
      poll_interval: 5000,
      retry_delay: 10000,
      max_retries: -1,
      since_startup: true,
    };
  }

  // Validate wallets
  if (!config.wallets || config.wallets.length === 0) {
    throw new Error('No wallets configured. Add at least one wallet in the config.');
  }

  for (const wallet of config.wallets) {
    if (!wallet.name) {
      throw new Error('Each wallet must have a "name"');
    }
    if (!wallet.connection_file && !wallet.connection_string) {
      throw new Error(`Wallet "${wallet.name}": either connection_file or connection_string required`);
    }
    if (!wallet.actions || wallet.actions.length === 0) {
      logger.warn(`Wallet "${wallet.name}": no actions configured, using console only`);
      wallet.actions = [{ type: 'console', enabled: true }];
    }
  }

  return config;
}

/**
 * Load NWC connection string for a wallet
 */
export async function loadConnectionString(wallet: WalletConfig): Promise<string> {
  if (wallet.connection_string) {
    return wallet.connection_string;
  }

  if (wallet.connection_file) {
    const path = expandHome(wallet.connection_file);

    if (!existsSync(path)) {
      throw new Error(`Connection file not found for wallet "${wallet.name}": ${path}`);
    }

    const file = Bun.file(path);
    const content = await file.text();
    return content.trim();
  }

  throw new Error(`No connection string for wallet "${wallet.name}"`);
}
