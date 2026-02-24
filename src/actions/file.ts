// File action - append payments to JSONL or CSV file

import { BaseAction } from './base';
import type { ActionResult, Payment } from '../types';
import { appendFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { logger } from '../utils/logger';

type FileFormat = 'jsonl' | 'csv';

export class FileAction extends BaseAction {
  private filePath: string = './data/payments.jsonl';
  private format: FileFormat = 'jsonl';

  constructor() {
    super('file');
  }

  async init(config: any): Promise<void> {
    await super.init(config);
    
    if (config.path) {
      this.filePath = resolve(config.path);
    }
    
    if (config.format) {
      this.format = config.format.toLowerCase();
      if (this.format !== 'jsonl' && this.format !== 'csv') {
        throw new Error('File format must be "jsonl" or "csv"');
      }
    }
    
    // Ensure directory exists
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    // Write CSV header if file doesn't exist and format is CSV
    if (this.format === 'csv' && !existsSync(this.filePath)) {
      const header = 'id,wallet,type,amount_sats,description,payment_hash,preimage,payer_pubkey,settled_at\n';
      await appendFile(this.filePath, header, 'utf-8');
    }
    
    logger.debug(`File action initialized: ${this.filePath} (${this.format})`);
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      let line: string;
      
      if (this.format === 'jsonl') {
        line = JSON.stringify(payment) + '\n';
      } else {
        // CSV format
        const escapeCsv = (str: string | undefined) => {
          if (!str) return '';
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };
        
        line = [
          payment.id,
          payment.wallet,
          payment.type,
          payment.amount_sats,
          escapeCsv(payment.description),
          payment.payment_hash,
          payment.preimage || '',
          payment.payer_pubkey || '',
          new Date(payment.settled_at).toISOString(),
        ].join(',') + '\n';
      }
      
      await appendFile(this.filePath, line, 'utf-8');
      
      return this.success({
        filePath: this.filePath,
        format: this.format,
      });
    } catch (error) {
      return this.failure(error as Error);
    }
  }
}
