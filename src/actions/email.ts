/**
 * Email action - send payment notification via SMTP
 */

import { BaseAction } from './base';
import type { ActionConfig, ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

export class EmailAction extends BaseAction {
  private smtp: { host: string; port: number; auth?: { user: string; pass: string } };
  private from: string;
  private to: string;
  private subject: string;
  private bodyTemplate: string;

  constructor(config: ActionConfig) {
    super(config);
    
    const smtp = config.smtp as any;
    if (!smtp || !smtp.host) {
      throw new Error('EmailAction requires "smtp" config with host');
    }

    this.smtp = { host: smtp.host, port: smtp.port || 587, auth: smtp.auth };
    this.from = config.from as string;
    this.to = config.to as string;
    this.subject = (config.subject as string) || 'NWC Payment Received';
    this.bodyTemplate = (config.body as string) || 
      'Payment on {wallet}: {amount_sats} sats - {description}';

    if (!this.from || !this.to) {
      throw new Error('EmailAction requires "from" and "to" config');
    }
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      const subject = this.replaceTemplates(this.subject, payment);
      const body = this.replaceTemplates(this.bodyTemplate, payment);

      // Note: Basic SMTP implementation - for production use nodemailer
      logger.info(`Email notification: ${subject} -> ${this.to}`);
      logger.debug(`Email body: ${body}`);
      
      // TODO: Implement actual SMTP sending
      return this.success({ to: this.to, subject });
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
