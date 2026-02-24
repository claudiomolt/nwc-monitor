/**
 * Configuration loader with YAML support
 */

import { readFileSync } from 'fs';
import { parse } from 'yaml';
import { homedir } from 'os';
import { resolve } from 'path';
import type { AppConfig, WalletConfig } from './types';
import { logger } from './utils/logger';

function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return resolve(homedir(), path.slice(2));
  }
  return path;
}

function expandPaths(obj: any): any {
  if (typeof obj === 'string') return expandPath(obj);
  if (Array.isArray(obj)) return obj.map(expandPaths);
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'path' || key === 'file' || key === 'database') {
        result[key] = typeof value === 'string' ? expandPath(value) : value;
      } else {
        result[key] = expandPaths(value);
      }
    }
    return result;
  }
  return obj;
}

export function loadConfig(configPath: string): AppConfig {
  logger.debug(`Loading config from ${configPath}`);
  const configFile = expandPath(configPath);
  const content = readFileSync(configFile, 'utf-8');
  const rawConfig = parse(content);
  const config = expandPaths(rawConfig) as AppConfig;
  validateConfig(config);
  return config;
}

function validateConfig(config: AppConfig): void {
  const hasLegacy = config.nwc && config.actions;
  const hasMultiWallet = config.wallets && Array.isArray(config.wallets);
  
  if (!hasLegacy && !hasMultiWallet) {
    throw new Error('Config must have either "nwc" + "actions" (legacy) or "wallets" array');
  }
  
  if (hasMultiWallet && config.wallets) {
    for (const wallet of config.wallets) {
      if (!wallet.name) throw new Error('Each wallet must have a "name"');
      if (!wallet.nwc) throw new Error(`Wallet "${wallet.name}" missing "nwc"`);
      if (!wallet.actions || !Array.isArray(wallet.actions)) {
        throw new Error(`Wallet "${wallet.name}" missing "actions" array`);
      }
    }
  }
  
  if (!config.monitor) throw new Error('Config missing "monitor" section');
  if (!config.monitor.pollInterval) throw new Error('Monitor missing "pollInterval"');
  if (!config.monitor.limit) throw new Error('Monitor missing "limit"');
  
  logger.debug('Config validation passed');
}

export function normalizeConfig(config: AppConfig): WalletConfig[] {
  if (config.wallets && Array.isArray(config.wallets)) {
    return config.wallets;
  }
  
  if (config.nwc && config.actions) {
    logger.info('Converting legacy single-wallet config to multi-wallet format');
    return [{
      name: 'default',
      nwc: config.nwc,
      actions: config.actions,
    }];
  }
  
  throw new Error('Invalid config: no wallets defined');
}
