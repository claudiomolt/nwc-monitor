import { Database } from 'bun:sqlite';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { BaseAction } from './base';
import type { ActionConfig, ActionResult, Payment } from '../types';

export class SqliteAction extends BaseAction {
  private db: Database;
  private table: string;

  constructor(config: ActionConfig) {
    super(config);
    const dbPath = config.database as string;
    this.table = (config.table as string) || 'payments';
    if (!dbPath) throw new Error('SqliteAction requires "database"');
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.run(`CREATE TABLE IF NOT EXISTS ${this.table} (
      id INTEGER PRIMARY KEY AUTOINCREMENT, wallet TEXT, type TEXT, invoice TEXT, description TEXT,
      description_hash TEXT, preimage TEXT, payment_hash TEXT UNIQUE, amount INTEGER, fees_paid INTEGER,
      created_at INTEGER, expires_at INTEGER, settled_at INTEGER, metadata TEXT,
      recorded_at INTEGER DEFAULT (strftime('%s', 'now')))`);
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      const stmt = this.db.prepare(`INSERT INTO ${this.table} (wallet,type,invoice,description,description_hash,
        preimage,payment_hash,amount,fees_paid,created_at,expires_at,settled_at,metadata)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
      stmt.run(payment.wallet, payment.type, payment.invoice, payment.description, payment.description_hash,
        payment.preimage, payment.payment_hash, payment.amount, payment.fees_paid, payment.created_at,
        payment.expires_at, payment.settled_at, JSON.stringify(payment.metadata));
      return this.success();
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) return this.success({ skipped: true });
      return this.failure(error instanceof Error ? error.message : String(error));
    }
  }
}
