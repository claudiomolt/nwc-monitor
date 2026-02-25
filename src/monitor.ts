/**
 * NWC Monitor - Relay subscription (primary) with listTransactions fallback
 */

import { nwc } from '@getalby/sdk';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { WalletConfig, MonitorConfig, Payment } from './types';
import { logger } from './utils/logger';
import { parseTransaction } from './utils/nostr';
import { ActionPipeline } from './actions/index';

const STATE_DIR = join(process.cwd(), 'data');
const STATE_FILE = join(STATE_DIR, 'state.json');

interface PersistedState {
  wallets: Record<string, { seenHashes: string[]; lastSeenTimestamp: number }>;
}

function loadState(): PersistedState {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    logger.warn('Failed to load state file, starting fresh');
  }
  return { wallets: {} };
}

function saveState(state: PersistedState): void {
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    logger.error('Failed to save state:', e);
  }
}

/**
 * Monitor a single wallet via relay subscription
 */
export class WalletMonitor {
  private wallet: WalletConfig;
  private config: MonitorConfig;
  private client: nwc.NWCClient;
  private pipeline: ActionPipeline;
  private seenHashes: Set<string>;
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

    // Load persisted state
    const state = loadState();
    const walletState = state.wallets[wallet.name];
    if (walletState) {
      this.seenHashes = new Set(walletState.seenHashes);
      this.lastSeenTimestamp = walletState.lastSeenTimestamp;
      logger.info(`Restored state for wallet ${wallet.name}: ${this.seenHashes.size} seen hashes, last timestamp ${this.lastSeenTimestamp}`);
    } else {
      this.seenHashes = new Set();
      this.lastSeenTimestamp = Math.floor(Date.now() / 1000);
      logger.info(`No previous state for wallet ${wallet.name}, starting from now`);
    }
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

    this.persistState();
    logger.info(`Stopped monitor for wallet: ${this.wallet.name}`);
  }

  private persistState(): void {
    const state = loadState();
    state.wallets[this.wallet.name] = {
      seenHashes: Array.from(this.seenHashes).slice(-500), // Keep last 500
      lastSeenTimestamp: this.lastSeenTimestamp,
    };
    saveState(state);
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

      if (this.seenHashes.has(tx.payment_hash)) {
        logger.debug(`Skipping duplicate: ${tx.payment_hash}`);
        return;
      }

      this.seenHashes.add(tx.payment_hash);

      const payment = parseTransaction(tx, this.wallet.name);
      await this.pipeline.execute(payment);

      if (tx.settled_at && tx.settled_at > this.lastSeenTimestamp) {
        this.lastSeenTimestamp = tx.settled_at;
      }

      // Persist state to disk
      this.persistState();
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
