/**
 * Base action class with common functionality
 */

import type { Action, ActionConfig, ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

export abstract class BaseAction implements Action {
  public readonly name: string;
  protected config: ActionConfig;

  constructor(config: ActionConfig) {
    this.config = config;
    this.name = config.type;
  }

  abstract execute(payment: Payment): Promise<ActionResult>;

  protected success(data?: unknown): ActionResult {
    return { success: true, data };
  }

  protected failure(error: string): ActionResult {
    logger.error(`Action ${this.name} failed:`, error);
    return { success: false, error };
  }

  protected replaceTemplates(template: string, payment: Payment): string {
    return template
      .replace(/\{wallet\}/g, payment.wallet)
      .replace(/\{amount_sats\}/g, payment.amount.toString())
      .replace(/\{amount_btc\}/g, (payment.amount / 100_000_000).toFixed(8))
      .replace(/\{description\}/g, payment.description)
      .replace(/\{payment_hash\}/g, payment.payment_hash)
      .replace(/\{invoice\}/g, payment.invoice)
      .replace(/\{preimage\}/g, payment.preimage)
      .replace(/\{type\}/g, payment.type)
      .replace(/\{fees_paid\}/g, payment.fees_paid.toString())
      .replace(/\{created_at\}/g, new Date(payment.created_at * 1000).toISOString())
      .replace(/\{settled_at\}/g, new Date(payment.settled_at * 1000).toISOString());
  }
}
