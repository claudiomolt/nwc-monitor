/**
 * NWC Monitor - Relay subscription (primary) with listTransactions fallback
 */

import { nwc } from '@getalby/sdk';
import type { WalletConfig, MonitorConfig, Payment } from './types';
import { logger } from './utils/logger';
import { parseTransaction } from './utils/nostr';
import { ActionPipeline } from './actions/index';
import { hasSeen, markSeen } from './utils/dedup';

/**
 * Monitor a single wallet via relay subscription
 */
export class WalletMonitor {
  private wallet: WalletConfig;
  private config: MonitorConfig;
  private client: nwc.NWCClient;
  private pipeline: ActionPipeline;
  private lastSeenTimestamp: number;
  private running: boolean;
  private subscriptionActive: boolean;
  private unsubscribe: (() => void) | null = null;
  private sanityCheckTimer?: ReturnType<typeof setInterval>;

  constructor(wallet: WalletConfig, nwcConnectionString: string, config: MonitorConfig) {
    this.wallet = wallet;
    this.config = config;
    this.client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcConnectionString });
    this.pipeline = new ActionPipeline(wallet.actions);
    this.running = false;
    this.subscriptionActive = false;
    // Start from 24 hours ago to catch any recent payments on first run
    this.lastSeenTimestamp = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.warn(`Wallet ${this.wallet.name} already running`);
      return;
    }

    this.running = true;
    logger.info(`Starting monitor for wallet: ${this.wallet.name}`);

    try {
      await this.catchUp();
      await this.subscribe();
      this.startSanityCheck();
      logger.info(`Wallet ${this.wallet.name} monitoring active (subscription + sanity checks)`);
    } catch (error) {
      logger.error(`Failed to start wallet ${this.wallet.name}:`, error);
      this.running = false;
      throw error;
    }
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;
    this.subscriptionActive = false;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.sanityCheckTimer) {
      clearInterval(this.sanityCheckTimer);
      this.sanityCheckTimer = undefined;
    }

    logger.info(`Stopped monitor for wallet: ${this.wallet.name}`);
  }

  private async catchUp(): Promise<void> {
    try {
      logger.debug(`Catching up payments for wallet: ${this.wallet.name}`);

      const response = await this.client.listTransactions({
        from: this.lastSeenTimestamp,
        limit: this.config.limit,
      });

      const transactions = response.transactions || [];

      if (transactions.length === 0) {
        logger.debug(`No catch-up payments for wallet: ${this.wallet.name}`);
        return;
      }

      logger.info(`Catching up ${transactions.length} payment(s) for wallet: ${this.wallet.name}`);

      for (const tx of transactions) {
        await this.processTransaction(tx);
      }
    } catch (error) {
      logger.error(`Catch-up failed for wallet ${this.wallet.name}:`, error);
    }
  }

  private async subscribe(): Promise<void> {
    try {
      logger.debug(`Subscribing to relay for wallet: ${this.wallet.name}`);

      this.unsubscribe = await this.client.subscribeNotifications(
        async (notification: any) => {
          try {
            logger.debug(`Notification for wallet ${this.wallet.name}:`, notification.notification_type);

            if (notification.notification_type === 'payment_received') {
              const n = notification.notification || notification;
              logger.debug(`Notification received for ${this.wallet.name}, fetching full details via listTransactions`);
              // Subscription gives us a signal but incomplete data
              // Use listTransactions to get the full payment details
              await this.catchUp();
            }
          } catch (error) {
            logger.error(`Error processing notification for wallet ${this.wallet.name}:`, error);
          }
        },
        ['payment_received']
      );

      this.subscriptionActive = true;
      logger.info(`Subscribed to relay for wallet: ${this.wallet.name}`);
    } catch (error) {
      logger.error(`Subscription failed for wallet ${this.wallet.name}:`, error);
      this.subscriptionActive = false;

      setTimeout(() => {
        if (this.running) {
          logger.info(`Retrying subscription for wallet: ${this.wallet.name}`);
          this.subscribe();
        }
      }, 5000);
    }
  }

  private startSanityCheck(): void {
    this.sanityCheckTimer = setInterval(async () => {
      if (!this.running) return;

      logger.debug(`Sanity check for wallet: ${this.wallet.name}`);
      await this.catchUp();

      if (!this.subscriptionActive && this.running) {
        logger.warn(`Subscription inactive for wallet ${this.wallet.name}, reconnecting...`);
        await this.subscribe();
      }
    }, 60000);
  }

  private async processTransaction(tx: any): Promise<void> {
    try {
      if (tx.type !== 'incoming' || !tx.settled_at) return;

      // Check file-based dedup
      if (hasSeen(tx.payment_hash)) {
        logger.debug(`Skipping duplicate (seen in file): ${tx.payment_hash}`);
        return;
      }

      // Mark as seen BEFORE executing pipeline (so if pipeline fails, we don't retry)
      markSeen(tx.payment_hash);
      logger.info(`New payment: ${tx.payment_hash}`);

      const payment = parseTransaction(tx, this.wallet.name);
      await this.pipeline.execute(payment);

      if (tx.settled_at && tx.settled_at > this.lastSeenTimestamp) {
        this.lastSeenTimestamp = tx.settled_at;
      }
    } catch (error) {
      logger.error(`Failed to process transaction for wallet ${this.wallet.name}:`, error);
    }
  }
}

/**
 * Orchestrator for multiple wallet monitors
 */
export class NWCMonitor {
  private monitors: WalletMonitor[];

  constructor(wallets: WalletConfig[], connectionStrings: Map<string, string>, config: MonitorConfig) {
    this.monitors = wallets.map((wallet) => {
      const nwcStr = connectionStrings.get(wallet.name);
      if (!nwcStr) {
        throw new Error(`No connection string found for wallet: ${wallet.name}`);
      }
      return new WalletMonitor(wallet, nwcStr, config);
    });
  }

  async start(): Promise<void> {
    logger.info(`Starting NWC monitor for ${this.monitors.length} wallet(s) with relay subscription`);
    await Promise.all(this.monitors.map((m) => m.start()));
  }

  stop(): void {
    logger.info('Stopping all wallet monitors');
    this.monitors.forEach((m) => m.stop());
  }
}
