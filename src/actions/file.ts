import { appendFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { BaseAction } from './base';
import type { ActionConfig, ActionResult, Payment } from '../types';

export class FileAction extends BaseAction {
  private filePath: string;
  private format: 'jsonl' | 'csv';

  constructor(config: ActionConfig) {
    super(config);
    this.filePath = config.path as string;
    this.format = (config.format as 'jsonl' | 'csv') || 'jsonl';
    if (!this.filePath) throw new Error('FileAction requires "path"');
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (this.format === 'csv' && !existsSync(this.filePath)) {
      writeFileSync(this.filePath, 'wallet,type,amount,description,payment_hash,settled_at\n');
    }
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      let line: string;
      if (this.format === 'jsonl') {
        line = JSON.stringify(payment) + '\n';
      } else {
        const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
        line = [esc(payment.wallet), esc(payment.type), payment.amount, esc(payment.description),
          esc(payment.payment_hash), new Date(payment.settled_at * 1000).toISOString()].join(',') + '\n';
      }
      appendFileSync(this.filePath, line);
      return this.success();
    } catch (error) {
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
