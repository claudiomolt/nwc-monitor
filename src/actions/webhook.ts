/**
 * Webhook action - POST payment data to HTTP endpoint
 */

import { BaseAction } from './base.js';
import type { ActionConfig, ActionResult, Payment } from '../types.js';
import { logger } from '../utils/logger.js';

export class WebhookAction extends BaseAction {
  private url: string;
  private timeout: number;
  private retries: number;
  private headers: Record<string, string>;

  constructor(config: ActionConfig) {
    super(config);
    this.url = config.url as string;
    this.timeout = (config.timeout as number) || 10000;
    this.retries = (config.retries as number) || 3;
    this.headers = (config.headers as Record<string, string>) || {};

    if (!this.url) {
      throw new Error('WebhookAction requires "url" config');
    }
  }

  async execute(payment: Payment): Promise<ActionResult> {
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.headers,
          },
          body: JSON.stringify(payment),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        logger.debug(`Webhook delivered to ${this.url}`);
        return this.success({ status: response.status });
      } catch (error) {
        const isLastAttempt = attempt === this.retries;
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (isLastAttempt) {
          return this.failure(`Failed after ${this.retries + 1} attempts: ${errorMsg}`);
        }

        logger.warn(`Webhook attempt ${attempt + 1} failed: ${errorMsg}, retrying...`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return this.failure('Webhook failed (unexpected)');
  }
}
