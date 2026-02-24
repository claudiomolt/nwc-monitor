// Configuration loader with YAML support and legacy compatibility

import { parse } from 'yaml';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { AppConfig, WalletConfig, MonitorConfig } from './types';

const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  retry_delay: 10000,
  max_retries: -1,
  sanity_check_interval: 60000,
  since_startup: true,
};

/**
 * Expand tilde in file paths to home directory
 */
function expandTilde(filePath: string): string {
  if (filePath.startsWith('~/')) {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    return filePath.replace('~', home);
  }
  return filePath;
}

/**
 * Read connection string from file
 */
async function readConnectionFile(filePath: string): Promise<string> {
  const expanded = expandTilde(filePath);
  const resolved = resolve(expanded);
  
  if (!existsSync(resolved)) {
    throw new Error(`Connection file not found: ${resolved}`);
  }
  
  const content = await readFile(resolved, 'utf-8');
  return content.trim();
}

/**
 * Load and validate configuration from YAML file
 */
export async function loadConfig(configPath: string): Promise<AppConfig> {
  const resolved = resolve(configPath);
  
  if (!existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }
  
  const content = await readFile(resolved, 'utf-8');
  const raw = parse(content);
  
  // Handle legacy single-wallet format
  if (raw.nwc && !raw.wallets) {
    const legacyWallet = await convertLegacyConfig(raw);
    raw.wallets = [legacyWallet];
  }
  
  // Validate config
  if (!raw.wallets || !Array.isArray(raw.wallets) || raw.wallets.length === 0) {
    throw new Error('Config must have at least one wallet in "wallets" array');
  }
  
  // Merge monitor config with defaults
  const monitorConfig: MonitorConfig = {
    ...DEFAULT_MONITOR_CONFIG,
    ...raw.monitor,
  };
  
  // Process each wallet config
  const wallets: WalletConfig[] = [];
  for (const wallet of raw.wallets) {
    if (!wallet.name) {
      throw new Error('Each wallet must have a "name" field');
    }
    
    // Load connection string
    let connectionString: string | undefined;
    
    if (wallet.connection_file) {
      connectionString = await readConnectionFile(wallet.connection_file);
    } else if (wallet.connection_string) {
      connectionString = wallet.connection_string;
    } else {
      throw new Error(`Wallet "${wallet.name}" must have either connection_file or connection_string`);
    }
    
    // Validate actions
    if (!wallet.actions || !Array.isArray(wallet.actions) || wallet.actions.length === 0) {
      throw new Error(`Wallet "${wallet.name}" must have at least one action`);
    }
    
    wallets.push({
      name: wallet.name,
      connection_string: connectionString,
      actions: wallet.actions,
      monitor: wallet.monitor ? { ...monitorConfig, ...wallet.monitor } : undefined,
    });
  }
  
  return {
    wallets,
    monitor: monitorConfig,
  };
}

/**
 * Convert legacy single-wallet config to multi-wallet format
 */
async function convertLegacyConfig(raw: any): Promise<WalletConfig> {
  let connectionString: string | undefined;
  
  if (raw.nwc.connection_file) {
    connectionString = await readConnectionFile(raw.nwc.connection_file);
  } else if (raw.nwc.connection_string) {
    connectionString = raw.nwc.connection_string;
  } else {
    throw new Error('Legacy config must have either nwc.connection_file or nwc.connection_string');
  }
  
  return {
    name: 'default',
    connection_string: connectionString,
    actions: raw.actions || [],
  };
}
