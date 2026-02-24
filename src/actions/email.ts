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
    if (!smtp?.host) throw new Error('EmailAction requires smtp.host');
    this.smtp = { host: smtp.host, port: smtp.port || 587, auth: smtp.auth };
    this.from = config.from as string;
    this.to = config.to as string;
    this.subject = (config.subject as string) || 'Payment Received';
    this.bodyTemplate = (config.body as string) || 'Payment: {amount_sats} sats - {description}';
    if (!this.from || !this.to) throw new Error('EmailAction requires from/to');
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      logger.info(`Email action executed (not implemented): ${this.to}`);
      return this.success();
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
