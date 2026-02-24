// NWC Monitor - subscription-first with polling fallback

import { NWCClient } from '@getalby/sdk';
import type { WalletConfig, MonitorConfig, Payment } from './types';
import { ActionPipeline } from './actions';
import { logger } from './utils/logger';
import { parseTransaction, shouldProcessTransaction } from './utils/nostr';

/**
 * Per-wallet monitor instance
 */
export class WalletMonitor {
  private client: NWCClient;
  private pipeline: ActionPipeline;
  private config: MonitorConfig;
  private walletName: string;
  private walletConfig: WalletConfig;
  
  private lastSeenTimestamp: number = 0;
  private processedIds = new Set<string>();
  private sanityCheckInterval: Timer | null = null;
  private isConnected = false;
  private reconnectTimer: Timer | null = null;
  
  constructor(
    walletConfig: WalletConfig,
    globalConfig: MonitorConfig
  ) {
    this.walletName = walletConfig.name;
    this.walletConfig = walletConfig;
    this.config = { ...globalConfig, ...walletConfig.monitor };
    
    // Initialize NWC client
    this.client = new NWCClient({ nostrWalletConnectUrl: walletConfig.connection_string! });
    
    // Initialize action pipeline
    this.pipeline = new ActionPipeline(this.walletName, walletConfig.actions);
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    logger.info(`[${this.walletName}] Starting monitor...`);
    
    // Initialize actions
    await this.pipeline.init(this.walletConfig.actions);
    
    // Set initial timestamp
    if (this.config.since_startup) {
      this.lastSeenTimestamp = Math.floor(Date.now() / 1000);
    } else if (this.config.since_timestamp) {
      this.lastSeenTimestamp = this.config.since_timestamp;
    }
    
    logger.debug(`[${this.walletName}] Starting from timestamp: ${this.lastSeenTimestamp}`);
    
    // 1. Catch up on missed payments
    await this.catchUp();
    
    // 2. Subscribe to real-time events
    await this.subscribe();
    
    // 3. Start periodic sanity check
    this.startSanityCheck();
    
    logger.info(`[${this.walletName}] Monitor started (${this.pipeline.getEnabledActions().join(', ')})`);
  }

  /**
   * Catch up on missed payments using listTransactions
   */
  private async catchUp(): Promise<void> {
    try {
      logger.debug(`[${this.walletName}] Catching up from timestamp ${this.lastSeenTimestamp}...`);
      
      const response = await this.client.listTransactions({
        from: this.lastSeenTimestamp,
        limit: 100,
      });
      
      const transactions = response.transactions || [];
      const incoming = transactions.filter(tx => shouldProcessTransaction(tx, this.lastSeenTimestamp));
      
      logger.debug(`[${this.walletName}] Found ${incoming.length} new payments during catch-up`);
      
      for (const tx of incoming) {
        const payment = parseTransaction(tx, this.walletName);
        await this.processPayment(payment);
      }
    } catch (error) {
      logger.error(`[${this.walletName}] Catch-up failed:`, error);
    }
  }

  /**
   * Subscribe to relay for real-time payment notifications
   */
  private async subscribe(): Promise<void> {
    try {
      // Subscribe to notification events
      this.client.on('notification', async (event: any) => {
        logger.debug(`[${this.walletName}] Received notification event:`, event);
        
        // Parse notification and check if it's a payment
        if (event.notification && event.notification.type === 'payment_received') {
          try {
            // Fetch the full transaction details
            const tx = event.notification.transaction;
            if (tx && shouldProcessTransaction(tx)) {
              const payment = parseTransaction(tx, this.walletName);
              await this.processPayment(payment);
            }
          } catch (error) {
            logger.error(`[${this.walletName}] Failed to process notification:`, error);
          }
        }
      });
      
      // Handle disconnection
      this.client.on('disconnect', () => {
        logger.warn(`[${this.walletName}] Relay disconnected`);
        this.isConnected = false;
        this.scheduleReconnect();
      });
      
      // Handle connection
      this.client.on('connect', () => {
        logger.info(`[${this.walletName}] Relay connected`);
        this.isConnected = true;
      });
      
      this.isConnected = true;
    } catch (error) {
      logger.error(`[${this.walletName}] Subscription failed:`, error);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection after disconnect
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(async () => {
      logger.info(`[${this.walletName}] Attempting to reconnect...`);
      await this.catchUp(); // Fill gap
      await this.subscribe(); // Reconnect
    }, this.config.retry_delay);
  }

  /**
   * Start periodic sanity check (polling fallback)
   */
  private startSanityCheck(): void {
    if (this.sanityCheckInterval) {
      clearInterval(this.sanityCheckInterval);
    }
    
    this.sanityCheckInterval = setInterval(async () => {
      logger.debug(`[${this.walletName}] Running sanity check...`);
      await this.catchUp();
    }, this.config.sanity_check_interval);
  }

  /**
   * Process a payment through the action pipeline
   */
  private async processPayment(payment: Payment): Promise<void> {
    // Deduplication
    if (this.processedIds.has(payment.id)) {
      logger.debug(`[${this.walletName}] Skipping duplicate payment: ${payment.id}`);
      return;
    }
    
    this.processedIds.add(payment.id);
    
    // Update last seen timestamp
    const txTimestamp = Math.floor(payment.settled_at / 1000);
    if (txTimestamp > this.lastSeenTimestamp) {
      this.lastSeenTimestamp = txTimestamp;
    }
    
    logger.info(`[${this.walletName}] Processing payment: ${payment.amount_sats} sats (${payment.type})`);
    
    // Execute action pipeline
    const results = await this.pipeline.execute(payment);
    
    // Log results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (failed > 0) {
      logger.warn(`[${this.walletName}] Actions completed: ${successful} succeeded, ${failed} failed`);
    } else {
      logger.debug(`[${this.walletName}] All ${successful} actions succeeded`);
    }
    
    // Limit processed IDs cache size
    if (this.processedIds.size > 10000) {
      const idsArray = Array.from(this.processedIds);
      this.processedIds = new Set(idsArray.slice(-5000));
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info(`[${this.walletName}] Stopping monitor...`);
    
    if (this.sanityCheckInterval) {
      clearInterval(this.sanityCheckInterval);
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    await this.pipeline.shutdown();
    
    logger.info(`[${this.walletName}] Monitor stopped`);
  }
}

/**
 * Multi-wallet monitor orchestrator
 */
export class NWCMonitor {
  private monitors: WalletMonitor[] = [];
  
  constructor(
    private wallets: WalletConfig[],
    private config: MonitorConfig
  ) {}

  /**
   * Start all wallet monitors
   */
  async start(): Promise<void> {
    logger.info(`Starting NWC Monitor for ${this.wallets.length} wallet(s)...`);
    
    for (const walletConfig of this.wallets) {
      const monitor = new WalletMonitor(walletConfig, this.config);
      this.monitors.push(monitor);
      await monitor.start();
    }
    
    logger.info('All monitors started ✓');
  }

  /**
   * Stop all wallet monitors
   */
  async stop(): Promise<void> {
    logger.info('Stopping all monitors...');
    
    for (const monitor of this.monitors) {
      await monitor.stop();
    }
    
    logger.info('All monitors stopped');
  }
}
