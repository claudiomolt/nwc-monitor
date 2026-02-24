// Webhook action - HTTP POST with retry and timeout

import { BaseAction } from './base';
import type { ActionResult, Payment } from '../types';
import { logger } from '../utils/logger';

export class WebhookAction extends BaseAction {
  private url: string = '';
  private headers: Record<string, string> = {};
  private retry: number = 3;
  private timeout: number = 5000;

  constructor() {
    super('webhook');
  }

  async init(config: any): Promise<void> {
    await super.init(config);
    
    if (!config.url) {
      throw new Error('Webhook action requires "url" field');
    }
    
    this.url = config.url;
    this.headers = config.headers || {};
    this.retry = config.retry ?? 3;
    this.timeout = config.timeout ?? 5000;
    
    logger.debug(`Webhook initialized: ${this.url} (retry=${this.retry}, timeout=${this.timeout}ms)`);
  }

  async execute(payment: Payment): Promise<ActionResult> {
    const payload = {
      ...payment,
      settled_at: new Date(payment.settled_at).toISOString(),
    };
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.retry; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        const response = await fetch(this.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.headers,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return this.success({
          url: this.url,
          status: response.status,
          attempt: attempt + 1,
        });
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.retry) {
          logger.warn(`Webhook attempt ${attempt + 1} failed, retrying...`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    return this.failure(`Failed after ${this.retry + 1} attempts: ${lastError?.message}`);
  }
}
