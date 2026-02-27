/**
 * Lightning forward action - automatically send a % to another lightning address
 */

import { BaseAction } from './base';
import type { ActionConfig, ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';
import { readFileSync } from 'fs';
import { nwc } from '@getalby/sdk';

export class LightningForwardAction extends BaseAction {
  private percentage: number;
  private destination: string;
  private nwcClient: nwc.NWCClient | null = null;
  private nwcConnectionPath?: string;

  constructor(config: ActionConfig) {
    super(config);
    
    this.percentage = (config.percentage as number) || 25;
    this.destination = config.destination as string;
    this.nwcConnectionPath = config.nwc_connection_path as string | undefined;

    if (!this.destination) {
      throw new Error('LightningForwardAction requires "destination" (lightning address)');
    }

    if (this.percentage <= 0 || this.percentage > 100) {
      throw new Error('LightningForwardAction percentage must be between 0 and 100');
    }

    // Initialize NWC client if connection path provided
    if (this.nwcConnectionPath) {
      try {
        const nwcString = readFileSync(this.nwcConnectionPath, 'utf-8').trim();
        this.nwcClient = new nwc.NWCClient({ nostrWalletConnectUrl: nwcString });
        logger.info(`Lightning forward initialized: ${this.percentage}% → ${this.destination}`);
      } catch (error) {
        logger.error('Failed to initialize NWC client for forward:', error);
      }
    }
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      if (!this.nwcClient) {
        return this.failure('NWC client not initialized');
      }

      const amountSats = Math.floor(payment.amount / 1000);
      const forwardSats = Math.floor((amountSats * this.percentage) / 100);

      if (forwardSats < 1) {
        logger.debug(`Forward amount too small (${forwardSats} sats), skipping`);
        return this.success({ skipped: true, reason: 'amount_too_small' });
      }

      logger.info(`💸 Forwarding ${forwardSats} sats (${this.percentage}% of ${amountSats}) to ${this.destination}`);

      // Resolve lightning address to invoice
      const [username, domain] = this.destination.split('@');
      
      const lnurlUrl = `https://${domain}/.well-known/lnurlp/${username}`;
      const lnurlRes = await fetch(lnurlUrl);
      const lnurlData = await lnurlRes.json() as any;
      
      if (lnurlData.status === 'ERROR') {
        throw new Error(`LNURL error: ${lnurlData.reason}`);
      }
      
      const invoiceUrl = `${lnurlData.callback}?amount=${forwardSats * 1000}`;
      const invoiceRes = await fetch(invoiceUrl);
      const invoiceData = await invoiceRes.json() as any;
      
      if (invoiceData.status === 'ERROR') {
        throw new Error(`Invoice error: ${invoiceData.reason}`);
      }
      
      const invoice = invoiceData.pr;
      
      // Pay the invoice
      const result = await this.nwcClient.payInvoice({ invoice });
      
      logger.info(`✅ Forward payment sent: ${forwardSats} sats → ${this.destination}`);
      logger.info(`   Preimage: ${result.preimage}`);

      return this.success({
        amount_sats: forwardSats,
        percentage: this.percentage,
        destination: this.destination,
        preimage: result.preimage,
      });
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
