/**
 * Console action - log payment to stdout
 */

import { BaseAction } from './base';
import type { ActionConfig, ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

export class ConsoleAction extends BaseAction {
  constructor(config: ActionConfig) {
    super(config);
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      const template = (this.config.template as string) || 
        '[{wallet}] Payment: {amount_sats} sats - {description}';
      const message = this.replaceTemplates(template, payment);
      logger.info(message);
      return this.success();
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
