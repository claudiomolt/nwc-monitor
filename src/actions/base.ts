// Base action class for all action implementations

import type { Action, ActionConfig, ActionResult, Payment } from '../types';

export abstract class BaseAction implements Action {
  public name: string;
  public enabled: boolean;
  protected config: ActionConfig;

  constructor(name: string) {
    this.name = name;
    this.enabled = true;
    this.config = { type: name, enabled: true };
  }

  async init(config: ActionConfig): Promise<void> {
    this.config = config;
    this.enabled = config.enabled !== false;
  }

  abstract execute(payment: Payment): Promise<ActionResult>;

  async shutdown(): Promise<void> {
    // Default: no cleanup needed
  }

  /**
   * Apply template variables to a string
   */
  protected applyTemplate(template: string, payment: Payment): string {
    return template
      .replace(/{wallet}/g, payment.wallet)
      .replace(/{amount_sats}/g, payment.amount_sats.toString())
      .replace(/{description}/g, payment.description || '')
      .replace(/{payment_hash}/g, payment.payment_hash)
      .replace(/{preimage}/g, payment.preimage || '')
      .replace(/{type}/g, payment.type)
      .replace(/{settled_at}/g, new Date(payment.settled_at).toISOString())
      .replace(/{id}/g, payment.id)
      .replace(/{payer_pubkey}/g, payment.payer_pubkey || '');
  }

  /**
   * Create a success result
   */
  protected success(data?: any): ActionResult {
    return {
      success: true,
      action: this.name,
      data,
    };
  }

  /**
   * Create an error result
   */
  protected failure(error: string | Error): ActionResult {
    return {
      success: false,
      action: this.name,
      error: error instanceof Error ? error.message : error,
    };
  }
}
