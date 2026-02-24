# ⚡ NWC Monitor

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Bun Runtime](https://img.shields.io/badge/runtime-Bun-orange.svg)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![Bitcoin](https://img.shields.io/badge/bitcoin-lightning-yellow.svg)](https://lightning.network/)

Monitor incoming Bitcoin Lightning payments via NWC (Nostr Wallet Connect) with pluggable actions. Built for speed, reliability, and multi-wallet support.

## ✨ Features

- **🔔 Subscription-First Architecture** — Real-time payment detection via Nostr relay subscription (zero polling overhead)
- **🔄 Smart Fallback** — Polling only for startup catch-up, reconnection recovery, and periodic sanity checks
- **👥 Multi-Wallet Support** — Monitor multiple wallets simultaneously, each with independent action pipelines
- **🔌 Pluggable Actions** — Easily add custom actions (webhook, SQLite, email, console, file, OpenClaw integration)
- **🛡️ Deduplication** — Prevents duplicate payment processing
- **🔁 Auto-Reconnect** — Handles relay disconnections gracefully with automatic gap filling
- **⚡ Lightning Fast** — Built on Bun for maximum performance
- **🎯 TypeScript Strict** — Type-safe with full IntelliSense support

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/claudiomolt/nwc-monitor.git
cd nwc-monitor

# Install dependencies
bun install

# Copy example config
cp config/default.yml config/local.yml

# Edit config with your NWC connection
nano config/local.yml

# Run the monitor
bun run start --config config/local.yml
```

### Or install globally

```bash
# Install as global command
bun install -g nwc-monitor

# Run from anywhere
nwc-monitor --config ~/my-config.yml
```

## 📋 Configuration

### Multi-Wallet Format (Recommended)

```yaml
monitor:
  retry_delay: 10000              # Retry delay in milliseconds
  max_retries: -1                 # -1 for infinite retries
  sanity_check_interval: 60000    # Polling fallback interval (60s)
  since_startup: true             # Start from current time

wallets:
  - name: personal
    connection_file: "~/.alby-cli/connection-secret-personal.key"
    actions:
      - type: console
        enabled: true
      - type: sqlite
        enabled: true
        database: "./data/personal.db"

  - name: store
    connection_string: "nostr+walletconnect://..."
    monitor:
      sanity_check_interval: 30000  # Override per wallet
    actions:
      - type: webhook
        enabled: true
        url: "https://mystore.com/api/payment"
        headers:
          Authorization: "Bearer TOKEN"
        retry: 3
        timeout: 5000
```

### Legacy Single-Wallet Format

```yaml
nwc:
  connection_file: "~/.alby-cli/connection-secret.key"

monitor:
  retry_delay: 10000
  max_retries: -1
  sanity_check_interval: 60000
  since_startup: true

actions:
  - type: console
    enabled: true
  - type: sqlite
    enabled: true
    database: "./data/payments.db"
```

## 🎯 Built-in Actions

### 1. Console

Log payments to stdout with customizable templates.

```yaml
- type: console
  enabled: true
  template: "⚡ [{wallet}] {amount_sats} sats - {description}"
```

### 2. SQLite

Store payments in a local SQLite database.

```yaml
- type: sqlite
  enabled: true
  database: "./data/payments.db"
```

**Schema:**
```sql
CREATE TABLE payments (
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
  created_at INTEGER NOT NULL
);
```

### 3. File

Append payments to JSONL or CSV file.

```yaml
- type: file
  enabled: true
  path: "./data/payments.jsonl"
  format: "jsonl"  # or "csv"
```

### 4. Webhook

HTTP POST to external API with retry and timeout.

```yaml
- type: webhook
  enabled: true
  url: "https://example.com/api/payment"
  headers:
    Authorization: "Bearer TOKEN"
    X-Custom-Header: "value"
  retry: 3
  timeout: 5000
```

**Payload:**
```json
{
  "id": "hash_timestamp",
  "wallet": "store",
  "type": "invoice",
  "amount_sats": 1000,
  "description": "Order #123",
  "payment_hash": "abc123...",
  "preimage": "def456...",
  "payer_pubkey": "npub...",
  "settled_at": "2026-02-24T19:30:00.000Z",
  "metadata": {}
}
```

### 5. Email

Send payment notifications via SMTP.

```yaml
- type: email
  enabled: true
  smtp:
    host: smtp.gmail.com
    port: 465
    secure: true
    user: "your-email@gmail.com"
    pass: "app-password"
  from: "Store <store@example.com>"
  to: "owner@example.com"
  subject_template: "⚡ Payment: {amount_sats} sats"
  body_template: |
    New payment received!
    
    Amount: {amount_sats} sats
    Description: {description}
    Payment Hash: {payment_hash}
```

### 6. Session Send (OpenClaw Integration)

Notify OpenClaw agent via HTTP.

```yaml
- type: session_send
  enabled: true
  gateway_url: "http://localhost:3000"
  agent_id: "main"
  message_template: "⚡ Payment: {amount_sats} sats - {description}"
```

## 🎨 Template Variables

All action templates support these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `{wallet}` | Wallet name | `personal` |
| `{amount_sats}` | Amount in satoshis | `1000` |
| `{description}` | Payment description | `Order #123` |
| `{payment_hash}` | Lightning payment hash | `abc123...` |
| `{preimage}` | Payment preimage | `def456...` |
| `{type}` | Payment type | `invoice` or `keysend` |
| `{settled_at}` | Settlement timestamp (ISO) | `2026-02-24T19:30:00.000Z` |
| `{id}` | Unique payment ID | `hash_timestamp` |
| `{payer_pubkey}` | Payer's Nostr pubkey | `npub...` |

## 🔧 CLI Options

```bash
nwc-monitor [OPTIONS]

OPTIONS:
  -c, --config <path>    Path to YAML config file (default: ./config/default.yml)
  --verbose              Enable verbose debug logging
  -v, --version          Show version
  -h, --help             Show help
```

**Examples:**
```bash
# Use default config
nwc-monitor

# Use custom config
nwc-monitor --config ~/my-config.yml

# Enable verbose logging
nwc-monitor --verbose
```

## 🔌 Creating Custom Actions

### 1. Implement the Action Interface

```typescript
import { BaseAction } from './actions/base';
import type { ActionResult, Payment } from './types';

export class MyCustomAction extends BaseAction {
  constructor() {
    super('my_custom_action');
  }

  async init(config: any): Promise<void> {
    await super.init(config);
    // Initialize your action (database, API clients, etc.)
  }

  async execute(payment: Payment): Promise<ActionResult> {
    try {
      // Do something with the payment
      console.log(`Custom action: ${payment.amount_sats} sats`);
      
      return this.success({ processed: true });
    } catch (error) {
      return this.failure(error as Error);
    }
  }

  async shutdown(): Promise<void> {
    // Cleanup resources
  }
}
```

### 2. Register the Action

```typescript
// In src/actions/index.ts
import { MyCustomAction } from './my-custom-action';

registry.register('my_custom_action', MyCustomAction);
```

### 3. Use in Config

```yaml
actions:
  - type: my_custom_action
    enabled: true
    custom_option: "value"
```

## 🔗 Compatibility

Works with any NWC-compatible wallet:

- ✅ **Alby Hub** (self-hosted)
- ✅ **Alby Extension** (browser)
- ✅ **lncurl.lol** (Nostr-native wallet)
- ✅ **Primal Wallet**
- ✅ Any wallet supporting **NIP-47** (Nostr Wallet Connect)

## 🏗️ Architecture

### Subscription-First Design

```
┌─────────────────────────────────────────────────────────────┐
│  WalletMonitor                                              │
│                                                             │
│  1. Startup:                                                │
│     └─ catchUp() ───> listTransactions (fill gap)          │
│                                                             │
│  2. Real-time:                                              │
│     └─ subscribe() ──> Nostr relay subscription             │
│                                                             │
│  3. Fallback:                                               │
│     └─ sanityCheck() ─> Periodic poll (every 60s)          │
│                                                             │
│  4. Reconnection:                                           │
│     └─ onDisconnect() ─> wait → catchUp() → subscribe()    │
└─────────────────────────────────────────────────────────────┘
```

### Processing Pipeline

```
Payment Received
      ↓
  Deduplication (processedIds Set)
      ↓
  Action Pipeline
      ├─> Console Action
      ├─> SQLite Action
      ├─> Webhook Action
      ├─> Email Action
      ├─> File Action
      └─> Custom Actions
      ↓
  Results Logged
```

## 📊 Monitoring

### Enable Verbose Logging

```bash
nwc-monitor --config config/local.yml --verbose
```

### SQLite Query Examples

```sql
-- Total received per wallet
SELECT wallet, SUM(amount_sats) as total_sats, COUNT(*) as count
FROM payments
GROUP BY wallet;

-- Recent payments
SELECT wallet, amount_sats, description, datetime(settled_at, 'unixepoch') as time
FROM payments
ORDER BY settled_at DESC
LIMIT 10;

-- Payments by type
SELECT type, COUNT(*) as count, SUM(amount_sats) as total_sats
FROM payments
GROUP BY type;
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-action`)
3. Commit your changes (`git commit -m 'Add amazing action'`)
4. Push to the branch (`git push origin feature/amazing-action`)
5. Open a Pull Request

### Development

```bash
# Install dependencies
bun install

# Run in development mode (auto-reload)
bun run dev

# Type check
bun run typecheck

# Run tests (when available)
bun test
```

## 📝 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [@getalby/sdk](https://github.com/getAlby/js-sdk)
- Powered by [Bun](https://bun.sh)
- Inspired by the Bitcoin Lightning and Nostr communities

---

**Built with ⚡ by Claudio | Bitcoin o Muerte 💀**

[GitHub](https://github.com/claudiomolt/nwc-monitor) • [Issues](https://github.com/claudiomolt/nwc-monitor/issues) • [Discussions](https://github.com/claudiomolt/nwc-monitor/discussions)
