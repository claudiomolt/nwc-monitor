/**
 * SessionSend action - notify OpenClaw gateway agent
 */

import { BaseAction } from './base';
import type { ActionConfig, ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

export class SessionSendAction extends BaseAction {
  private gatewayUrl: string;
  private sessionId: string;
  private template: string;

  constructor(config: ActionConfig) {
    super(config);
    this.gatewayUrl = (config.gatewayUrl as string) || 'http://localhost:3000';
    this.sessionId = config.sessionId as string;
    this.template = (config.template as string) || 
      'Payment received on {wallet}: {amount_sats} sats - {description}';

    if (!this.sessionId) {
      throw new Error('SessionSendAction requires "sessionId" config');
    }
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      const message = this.replaceTemplates(this.template, payment);

      const response = await fetch(`${this.gatewayUrl}/api/sessions/${this.sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'user',
          content: message,
          metadata: {
            source: 'nwc-monitor',
            payment_hash: payment.payment_hash,
            wallet: payment.wallet,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.debug(`Session message sent to ${this.sessionId}`);
      return this.success();
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
