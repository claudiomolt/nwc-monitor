/**
 * Core type definitions for NWC Monitor
 */

export interface Payment {
  wallet: string;
  type: string;
  invoice: string;
  description: string;
  description_hash: string | null;
  preimage: string;
  payment_hash: string;
  amount: number;
  fees_paid: number;
  created_at: number;
  expires_at: number | null;
  settled_at: number;
  metadata: Record<string, unknown>;
}

export interface ActionConfig {
  type: string;
  [key: string]: unknown;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

export interface Action {
  name: string;
  execute(payment: Payment): Promise<ActionResult>;
}

export interface WalletConfig {
  name: string;
  nwc: string;
  actions: ActionConfig[];
}

export interface MonitorConfig {
  pollInterval: number;
  limit: number;
}

export interface AppConfig {
  nwc?: string;
  actions?: ActionConfig[];
  wallets?: WalletConfig[];
  monitor: MonitorConfig;
}
