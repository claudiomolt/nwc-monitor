# NWC Monitor — Agent Install Guide

Lightning payment monitor + wallet CLI via Nostr Wallet Connect.
Runs as a systemd service. Notifies you on every incoming payment.

## Install (copy-paste all at once)

```bash
# Clone and build
git clone https://github.com/claudiomolt/nwc-monitor.git ~/.nwc-monitor/repo
cd ~/.nwc-monitor/repo && bun install && bun run build

# Create config dir
mkdir -p ~/.nwc-monitor/data

# Detect paths
BUN_PATH="$(which bun)"
OPENCLAW_PATH="$(which openclaw 2>/dev/null || true)"
EXTRA_PATH="${OPENCLAW_PATH:+$(dirname $OPENCLAW_PATH):}"

# Create systemd service
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/nwc-monitor.service << EOF
[Unit]
Description=NWC Monitor
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$HOME/.nwc-monitor/repo
ExecStart=$BUN_PATH run dist/index.js
Restart=always
RestartSec=10
Environment=HOME=$HOME
Environment=PATH=${EXTRA_PATH}$(dirname $BUN_PATH):/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
```

**Prerequisite:** bun (`curl -fsSL https://bun.sh/install | bash`)

## Configure

Create `~/.nwc-monitor/config.yml` with the user's NWC connection string:

```yaml
monitor:
  pollInterval: 60000
  limit: 50

wallets:
  - name: default
    nwc: "nostr+walletconnect://REPLACE_WITH_NWC_STRING"
    actions:
      - type: console
        enabled: true
        template: "⚡ [{wallet}] {amount_sats} sats - {description}"
      - type: sqlite
        enabled: true
        database: "~/.nwc-monitor/data/payments.db"
```

### Add notifications (optional)

Append to the wallet's `actions` list:

```yaml
      - type: session_send
        enabled: true
        channel: whatsapp       # or: telegram, discord, signal
        target: "+PHONE_NUMBER" # or chat id
        template: "⚡ {amount_sats} sats — {description}"
```

### No NWC string?

If the user doesn't have one, create a wallet with the `lncurl` skill, or ask them for their Alby Hub / LNbits NWC connection string. Format: `nostr+walletconnect://PUBKEY?relay=wss://...&secret=SECRET`

## Start

```bash
systemctl --user enable --now nwc-monitor
```

Verify: `systemctl --user status nwc-monitor`

## Wallet CLI

Run from `~/.nwc-monitor/repo`:

```bash
cd ~/.nwc-monitor/repo

# Balance
bun nwc-cli.mjs balance

# Pay invoice
bun nwc-cli.mjs pay <bolt11_invoice>

# Pay Lightning address
bun nwc-cli.mjs pay-address <sats> user@domain.com

# Create invoice to receive
bun nwc-cli.mjs make-invoice <sats> --description "text"

# List transactions
bun nwc-cli.mjs list --limit 10
```

Multi-wallet: add `--wallet <name>` to any command.

## Service management

```bash
systemctl --user status nwc-monitor     # status
systemctl --user restart nwc-monitor    # restart
journalctl --user -u nwc-monitor -f     # logs
systemctl --user disable nwc-monitor    # disable auto-start
```

## Troubleshooting

- **0 wallet monitors** → `nwc` missing in config.yml
- **openclaw not found** → add openclaw to PATH in the .service file
- **service dies on logout** → `sudo loginctl enable-linger $USER`

---
Source: https://github.com/claudiomolt/nwc-monitor
