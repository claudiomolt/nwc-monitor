// Session Send action - notify OpenClaw agent via HTTP

import { BaseAction } from './base';
import type { ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

export class SessionSendAction extends BaseAction {
  private gatewayUrl: string = 'http://localhost:3000';
  private agentId: string = 'main';
  private messageTemplate: string = '⚡ Payment received on {wallet}: {amount_sats} sats - {description}';

  constructor() {
    super('session_send');
  }

  async init(config: any): Promise<void> {
    await super.init(config);
    
    if (config.gateway_url) {
      this.gatewayUrl = config.gateway_url.replace(/\/$/, '');
    }
    
    if (config.agent_id) {
      this.agentId = config.agent_id;
    }
    
    if (config.message_template) {
      this.messageTemplate = config.message_template;
    }
    
    logger.debug(`Session send initialized: ${this.gatewayUrl} -> ${this.agentId}`);
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      const message = this.applyTemplate(this.messageTemplate, payment);
      
      // Send message to OpenClaw gateway
      const url = `${this.gatewayUrl}/api/session/send`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agent_id: this.agentId,
          message,
          metadata: {
            payment_hash: payment.payment_hash,
            amount_sats: payment.amount_sats,
            wallet: payment.wallet,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return this.success({
        gatewayUrl: this.gatewayUrl,
        agentId: this.agentId,
        message,
      });
    } catch (error) {
      return this.failure(error as Error);
    }
  }
}
