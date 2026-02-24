// Core types for NWC payment monitor

export interface Payment {
  id: string;
  wallet: string;
  type: 'invoice' | 'keysend' | 'incoming' | 'outgoing';
  amount_sats: number;
  description?: string;
  payment_hash: string;
  preimage?: string;
  payer_pubkey?: string;
  settled_at: number;
  metadata?: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  action: string;
  wallet?: string;
  error?: string;
  data?: any;
}

export interface ActionConfig {
  type: string;
  enabled: boolean;
  [key: string]: any;
}

export interface Action {
  name: string;
  enabled: boolean;
  init(config: ActionConfig): Promise<void>;
  execute(payment: Payment): Promise<ActionResult>;
  shutdown(): Promise<void>;
}

export interface WalletConfig {
  name: string;
  connection_file?: string;
  connection_string?: string;
  actions: ActionConfig[];
  monitor?: Partial<MonitorConfig>;
}

export interface MonitorConfig {
  retry_delay: number;
  max_retries: number;
  sanity_check_interval: number;
  since_startup: boolean;
  since_timestamp?: number;
}

export interface AppConfig {
  wallets?: WalletConfig[];
  nwc?: {
    connection_file?: string;
    connection_string?: string;
  };
  actions?: ActionConfig[];
  monitor: MonitorConfig;
}
