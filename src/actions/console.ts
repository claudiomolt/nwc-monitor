// Console action - log payments to stdout

import { BaseAction } from './base';
import type { ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

export class ConsoleAction extends BaseAction {
  private template: string;

  constructor() {
    super('console');
    this.template = '⚡ [{wallet}] Received {amount_sats} sats - {description}';
  }

  async init(config: any): Promise<void> {
    await super.init(config);
    
    if (config.template) {
      this.template = config.template;
    }
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      const message = this.applyTemplate(this.template, payment);
      logger.info(message);
      
      return this.success({ message });
    } catch (error) {
      return this.failure(error as Error);
    }
  }
}
