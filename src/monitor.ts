/**
 * NWC Monitor - Listens for incoming payments via Nostr Wallet Connect
 * Supports multiple wallets with independent action pipelines
 */

import { nwc } from '@getalby/sdk';
import type { AppConfig, MonitorConfig, Payment, WalletConfig } from './types';
import { logger } from './utils/logger';
import { parseTransaction } from './utils/nostr';
import { ActionPipeline } from './actions';

/** Monitor for a single wallet */
class WalletMonitor {
  private client?: nwc.NWCClient;
  private wallet: WalletConfig;
  private pipeline: ActionPipeline;
  private monitorConfig: MonitorConfig;
  private running: boolean = false;
  private seenPayments: Set<string> = new Set();
  private lastCheckTimestamp: number;

  constructor(wallet: WalletConfig, globalMonitorConfig: MonitorConfig) {
    this.wallet = wallet;
    this.pipeline = new ActionPipeline();
    
    // Merge global + per-wallet monitor config
    this.monitorConfig = {
      ...globalMonitorConfig,
      ...wallet.monitor,
    };

    if (this.monitorConfig.since_startup) {
      this.lastCheckTimestamp = Math.floor(Date.now() / 1000);
    } else if (this.monitorConfig.since_timestamp) {
      this.lastCheckTimestamp = this.monitorConfig.since_timestamp;
    } else {
      this.lastCheckTimestamp = 0;
    }
  }

  async init(connectionString: string) {
    logger.info(`[${this.wallet.name}] Initializing NWC client...`);
    this.client = new nwc.NWCClient({ nostrWalletConnectUrl: connectionString });
    
    try {
      const info = await this.client.getInfo();
      logger.info(`[${this.wallet.name}] ✓ Connected: ${info.alias || 'unknown'}`);
    } catch (error: any) {
      logger.error(`[${this.wallet.name}] Failed to connect: ${error.message}`);
      throw error;
    }

    await this.pipeline.init(this.wallet.actions);
    logger.info(`[${this.wallet.name}] ✓ ${this.wallet.actions.filter(a => a.enabled !== false).length} actions loaded`);
  }

  async start() {
    if (this.running) return;
    this.running = true;
    logger.info(`[${this.wallet.name}] 🚀 Starting monitor...`);
    this.pollLoop();
  }

  async stop() {
    this.running = false;
  }

  private async pollLoop() {
    let retryCount = 0;

    while (this.running) {
      try {
        await this.checkPayments();
        retryCount = 0;
        await this.sleep(this.monitorConfig.poll_interval);
      } catch (error: any) {
        logger.error(`[${this.wallet.name}] Poll error: ${error.message}`);
        retryCount++;

        if (this.monitorConfig.max_retries !== -1 && retryCount >= this.monitorConfig.max_retries) {
          logger.error(`[${this.wallet.name}] Max retries reached, stopping`);
          this.running = false;
          break;
        }

        await this.sleep(this.monitorConfig.retry_delay);
      }
    }
  }

  private async checkPayments() {
    if (!this.client) throw new Error('Client not initialized');

    const response = await this.client.listTransactions({
      from: this.lastCheckTimestamp,
      limit: 100,
    });

    const transactions = Array.isArray(response) ? response : (response as any).transactions || [];
    if (transactions.length === 0) return;

    const incomingTxs = transactions.filter(
      (tx: any) => tx.type === 'incoming' && tx.settled_at && tx.settled_at > this.lastCheckTimestamp
    );

    if (incomingTxs.length === 0) return;

    logger.info(`[${this.wallet.name}] 📬 Found ${incomingTxs.length} new payments`);

    for (const tx of incomingTxs) {
      const payment = parseTransaction(tx, this.wallet.name);
      if (!payment) continue;

      if (this.seenPayments.has(payment.id)) continue;
      this.seenPayments.add(payment.id);

      logger.info(`[${this.wallet.name}] ⚡ ${payment.amount_sats} sats - ${payment.description}`);
      await this.pipeline.execute(payment);

      if (payment.settled_at > this.lastCheckTimestamp) {
        this.lastCheckTimestamp = payment.settled_at;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown() {
    await this.stop();
    await this.pipeline.shutdown();
  }
}

/** Multi-wallet monitor orchestrator */
export class NWCMonitor {
  private walletMonitors: WalletMonitor[] = [];
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  async initWallet(wallet: WalletConfig, connectionString: string) {
    const monitor = new WalletMonitor(wallet, this.config.monitor);
    await monitor.init(connectionString);
    this.walletMonitors.push(monitor);
  }

  async start() {
    logger.info(`🚀 Starting ${this.walletMonitors.length} wallet monitor(s)...`);
    await Promise.all(this.walletMonitors.map(m => m.start()));
  }

  async shutdown() {
    logger.info('Shutting down all wallet monitors...');
    await Promise.all(this.walletMonitors.map(m => m.shutdown()));
    logger.info('Monitor shutdown complete');
  }
}
