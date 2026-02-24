# NWC Monitor

[![npm version](https://img.shields.io/npm/v/nwc-monitor.svg)](https://www.npmjs.com/package/nwc-monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.0-orange.svg)](https://bun.sh)

**Monitor incoming Lightning payments from multiple NWC (Nostr Wallet Connect) wallets with configurable action pipelines.**

Built with Bun + TypeScript. Zero-dependency SQLite storage. Pluggable action system. Production-ready.

## ✨ Features

- 🔌 **Multi-Wallet Support** - Monitor multiple NWC wallets in parallel
- ⚡ **Real-time Monitoring** - Detect incoming invoices and keysends
- 🔧 **Pluggable Actions** - 6 built-in actions + extensible system
- 💾 **SQLite Storage** - Fast, zero-dependency database (Bun native)
- 📝 **File Logging** - Export to JSONL or CSV
- 🪝 **Webhooks** - POST payment data with retry logic
- 📧 **Email Notifications** - SMTP support with templates
- 🤖 **Agent Integration** - Send to OpenClaw agent sessions
- 🔄 **Auto-reconnect** - Graceful error handling and retry
- 🛡️ **Deduplication** - Prevents duplicate payment processing
- 🎛️ **Per-Wallet Config** - Override settings per wallet
- 📦 **npm Package** - Install globally or use with `npx`

## 📦 Installation

### Global Install

```bash
npm install -g nwc-monitor
```

### npx (No Install)

```bash
npx nwc-monitor --config config.yml
```

### Local Development

```bash
git clone https://github.com/claudiomolt/nwc-monitor
cd nwc-monitor
bun install
bun run build
```

## 🚀 Quick Start

1. **Create a config file** (`config.yml`):

```yaml
monitor:
  poll_interval: 5000

wallets:
  - name: main
    connection_file: "~/.alby-cli/connection-secret.key"
    actions:
      - type: console
      - type: sqlite
        database: "./data/payments.db"
```

2. **Run the monitor**:

```bash
nwc-monitor --config config.yml
```

3. **Send a Lightning payment** to your wallet and watch it appear in the console!

## ⚙️ Configuration

### Basic Configuration

```yaml
# Global monitor settings
monitor:
  poll_interval: 5000       # Check every 5 seconds
  retry_delay: 10000        # Retry after 10 seconds on error
  max_retries: -1           # Infinite retries
  since_startup: true       # Only process new payments

# Single wallet
wallets:
  - name: my-wallet
    connection_file: "~/.alby-cli/connection-secret.key"
    actions:
      - type: console
        format: "⚡ {amount_sats} sats | {description}"
```

### Multi-Wallet Configuration

Each wallet runs independently with its own action pipeline:

```yaml
monitor:
  poll_interval: 5000

wallets:
  # Personal wallet
  - name: personal
    connection_file: "~/.alby-cli/personal.key"
    actions:
      - type: console
        format: "💰 [{wallet}] {amount_sats} sats - {description}"
      - type: sqlite
        database: "./data/personal.db"

  # Business wallet (check more frequently)
  - name: business
    connection_file: "~/.alby-cli/business.key"
    monitor:
      poll_interval: 3000
    actions:
      - type: webhook
        url: "https://api.mybusiness.com/payment"
        headers:
          Authorization: "Bearer SECRET"
      - type: email
        to: "accounting@mybusiness.com"

  # Store wallet
  - name: store
    connection_string: "nostr+walletconnect://..."
    actions:
      - type: webhook
        url: "https://mystore.com/api/payment-received"
```

## 🔌 Built-in Actions

### Console

Log payments to stdout with customizable format.

```yaml
- type: console
  enabled: true
  format: "⚡ [{wallet}] {amount_sats} sats | {description} | {payment_hash}"
```

### File

Append payments to a file (JSONL or CSV).

```yaml
- type: file
  enabled: true
  path: "./data/payments.jsonl"
  format: jsonl  # or csv
```

### SQLite

Store payments in SQLite database.

```yaml
- type: sqlite
  enabled: true
  database: "./data/payments.db"
  table: payments
```

### Webhook

POST payment data to a URL with retry logic.

```yaml
- type: webhook
  enabled: true
  url: "https://api.example.com/payment"
  method: POST
  headers:
    Authorization: "Bearer YOUR_TOKEN"
  retry: 3
  timeout: 5000
```

### Email

Send email notifications via SMTP.

```yaml
- type: email
  enabled: true
  smtp:
    host: smtp.gmail.com
    port: 465
    secure: true
    user: "you@gmail.com"
    pass: "app-password"
  from: "NWC Monitor <noreply@example.com>"
  to: "recipient@example.com"
  subject_template: "⚡ Payment: {amount_sats} sats"
  body_template: |
    Payment received on {wallet}:
    Amount: {amount_sats} sats
    Description: {description}
    Hash: {payment_hash}
```

### Session Send

Send notifications to OpenClaw agent sessions.

```yaml
- type: session_send
  enabled: true
  gateway_url: "http://localhost:3000"
  agent_id: "main"
  message_template: "⚡ Payment received: {amount_sats} sats"
```

## 📝 Template Variables

All actions support these template variables:

| Variable | Description |
|----------|-------------|
| `{wallet}` | Wallet name |
| `{amount_sats}` | Amount in satoshis |
| `{description}` | Payment description/memo |
| `{payment_hash}` | Payment hash |
| `{preimage}` | Payment preimage (if available) |
| `{payer_pubkey}` | Payer's public key (if available) |
| `{settled_at}` | Settlement timestamp (ISO 8601) |
| `{type}` | Payment type (`invoice` or `keysend`) |
| `{id}` | Unique payment ID |

## 🏗️ Architecture

```
┌─────────────────┐
│   NWC Monitor   │ (Orchestrator)
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┐
    │         │        │        │
┌───▼───┐ ┌──▼───┐ ┌──▼───┐ ┌──▼───┐
│Wallet1│ │Wallet2│ │Wallet3│ │Wallet N│
└───┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
    │        │        │        │
┌───▼───────────────────────────▼───┐
│   Action Pipelines (per wallet)   │
│   [console, sqlite, webhook, ...]  │
└────────────────────────────────────┘
```

Each wallet:
- Connects to its own Nostr relay
- Has an independent action pipeline
- Can override global monitor settings
- Processes payments in parallel

## 🔧 Custom Actions

Create custom actions by extending the `BaseAction` class:

```typescript
// src/actions/my-action.ts
import { BaseAction } from './base';
import type { Payment, ActionResult } from '../types';

export class MyAction extends BaseAction {
  name = 'my_action';
  private apiKey: string = '';

  async init(config: any): Promise<void> {
    await super.init(config);
    this.apiKey = config.api_key;
  }

  async execute(payment: Payment): Promise<ActionResult> {
    console.log(`Processing ${payment.wallet}: ${payment.amount_sats} sats`);
    // Your custom logic here
    return this.success({ processed: true });
  }
}
```

Register in `src/actions/index.ts`:

```typescript
import { MyAction } from './my-action';

function registerBuiltinActions() {
  // ... existing actions
  actionRegistry.set('my_action', MyAction);
}
```

Use in config:

```yaml
actions:
  - type: my_action
    enabled: true
    api_key: "secret"
```

## 🐳 Deployment

### systemd

```ini
[Unit]
Description=NWC Payment Monitor
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/nwc-monitor
ExecStart=/usr/bin/nwc-monitor --config /path/to/config.yml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable nwc-monitor
sudo systemctl start nwc-monitor
```

### Docker

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install && bun run build
CMD ["./dist/index.js", "--config", "/config/config.yml"]
```

```yaml
# docker-compose.yml
services:
  nwc-monitor:
    build: .
    volumes:
      - ./config.yml:/config/config.yml:ro
      - ./data:/app/data
      - ~/.alby-cli:/root/.alby-cli:ro
    restart: unless-stopped
```

## 📊 Use Cases

### E-commerce Store

Receive instant webhook notifications when customers pay:

```yaml
wallets:
  - name: store
    connection_file: "~/.alby-cli/store.key"
    actions:
      - type: webhook
        url: "https://mystore.com/api/payment"
      - type: sqlite
        database: "./data/sales.db"
```

### Donation Tracker

Email alerts for every donation:

```yaml
wallets:
  - name: donations
    connection_file: "~/.alby-cli/donations.key"
    actions:
      - type: email
        to: "treasurer@nonprofit.org"
        subject_template: "💝 Donation: {amount_sats} sats"
      - type: file
        path: "./data/donations.csv"
        format: csv
```

### Multi-tenant SaaS

Separate webhooks per tenant:

```yaml
wallets:
  - name: tenant-1
    connection_file: "~/.alby-cli/tenant1.key"
    actions:
      - type: webhook
        url: "https://api.saas.com/tenant/1/payment"

  - name: tenant-2
    connection_file: "~/.alby-cli/tenant2.key"
    actions:
      - type: webhook
        url: "https://api.saas.com/tenant/2/payment"
```

## 🛠️ Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build for production
bun run build

# Test the build
./dist/index.js --config config/default.yml
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript strict mode
- Follow existing code style
- Add tests for new features
- Update documentation

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [@getalby/sdk](https://github.com/getAlby/js-sdk) - Nostr Wallet Connect client
- [Nostr](https://nostr.com) - Decentralized communication protocol

## 🔗 Links

- **npm:** https://www.npmjs.com/package/nwc-monitor
- **GitHub:** https://github.com/claudiomolt/nwc-monitor
- **Issues:** https://github.com/claudiomolt/nwc-monitor/issues
- **Nostr Wallet Connect:** https://nwc.getalby.com/

## 📞 Support

- **GitHub Issues:** For bugs and feature requests
- **Discussions:** For questions and community support

---

**Made with ⚡ and Nostr**
