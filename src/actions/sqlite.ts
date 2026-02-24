/**
 * SQLite action - save to database using Bun's built-in SQLite
 */

import { Database } from 'bun:sqlite';
import { BaseAction } from './base';
import type { ActionResult, Payment } from '../types';
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

export class SQLiteAction extends BaseAction {
  name = 'sqlite';
  private db?: Database;
  private dbPath: string = './data/payments.db';
  private table: string = 'payments';

  async init(config: any): Promise<void> {
    await super.init(config);
    this.dbPath = resolve(config.database || this.dbPath);
    this.table = config.table || this.table;

    const dir = dirname(this.dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath, { create: true });

    this.db.run(`
      CREATE TABLE IF NOT EXISTS ${this.table} (
        id TEXT PRIMARY KEY,
        wallet TEXT NOT NULL,
        type TEXT NOT NULL,
        amount_sats INTEGER NOT NULL,
        description TEXT,
        payment_hash TEXT NOT NULL,
        preimage TEXT,
        payer_pubkey TEXT,
        settled_at INTEGER NOT NULL,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_wallet ON ${this.table}(wallet)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_settled_at ON ${this.table}(settled_at)`);
  }

  async execute(payment: Payment): Promise<ActionResult> {
    if (!this.db) {
      return this.failure('Database not initialized');
    }

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ${this.table} 
        (id, wallet, type, amount_sats, description, payment_hash, preimage, payer_pubkey, settled_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        payment.id,
        payment.wallet,
        payment.type,
        payment.amount_sats,
        payment.description || null,
        payment.payment_hash,
        payment.preimage || null,
        payment.payer_pubkey || null,
        payment.settled_at,
        JSON.stringify(payment.metadata || {})
      );

      return this.success({ database: this.dbPath, table: this.table });
    } catch (error: any) {
      return this.failure(error.message);
    }
  }

  async shutdown(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }
}
