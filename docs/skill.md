# NWC Monitor — Agent Install Guide

Lightning payment monitor + wallet CLI via Nostr Wallet Connect.
Runs as a systemd service. Notifies you on every incoming payment.

## Install (copy-paste all at once)

```bash
# Install bun if missing
if ! command -v bun &>/dev/null; then
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
fi

# Install git if missing
if ! command -v git &>/dev/null; then
  sudo apt-get update && sudo apt-get install -y git || brew install git
fi

# Clone and build
git clone https://github.com/claudiomolt/nwc-monitor.git ~/.nwc-monitor/repo
cd ~/.nwc-monitor/repo && bun install && bun run build

# Create config dir
mkdir -p ~/.nwc-monitor/data

# Detect paths
BUN_PATH="$(which bun)"
OPENCLAW_PATH="$(which openclaw 2>/dev/null || true)"
EXTRA_PATH="${OPENCLAW_PATH:+$(dirname $OPENCLAW_PATH):}"

# Setup service (systemd or nohup fallback)
if command -v systemctl &>/dev/null && systemctl --user status &>/dev/null 2>&1; then
  # systemd available
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
  echo "✅ systemd service created"
else
  # No systemd — create nohup launcher
  cat > ~/.nwc-monitor/start.sh << EOF
#!/bin/bash
cd ~/.nwc-monitor/repo
export PATH="${EXTRA_PATH}$(dirname $BUN_PATH):/usr/local/bin:/usr/bin:/bin"
nohup $BUN_PATH run dist/index.js >> ~/.nwc-monitor/nwc-monitor.log 2>&1 &
echo \$! > ~/.nwc-monitor/nwc-monitor.pid
echo "✅ NWC Monitor started (pid \$!)"
EOF
  cat > ~/.nwc-monitor/stop.sh << EOF
#!/bin/bash
if [ -f ~/.nwc-monitor/nwc-monitor.pid ]; then
  kill \$(cat ~/.nwc-monitor/nwc-monitor.pid) 2>/dev/null
  rm ~/.nwc-monitor/nwc-monitor.pid
  echo "⏹ NWC Monitor stopped"
else
  echo "Not running"
fi
EOF
  chmod +x ~/.nwc-monitor/start.sh ~/.nwc-monitor/stop.sh
  echo "✅ nohup launcher created (no systemd found)"
fi
```

**No systemd?** After install, ask the user if they want NWC Monitor to start automatically with OpenClaw. If yes, add this to the agent's `BOOTSTRAP.md` (or create it):

```markdown
## NWC Monitor
Start the payment monitor on agent boot:
```bash
bash ~/.nwc-monitor/start.sh
```
```

## Configure

Before creating the config, resolve the NWC connection string:

1. **Check for alby-cli:** Look for `~/.alby-cli/connection-secret-*.key` files. If found, ask the user which wallet to use. Read the NWC string from that file.
2. **Ask the user:** If no alby-cli, ask if they have an NWC connection string (from Alby Hub, LNbits, etc.).
3. **Create one with lncurl:** If they don't have one, offer to create a disposable wallet:
   ```bash
   curl -s -X POST https://lncurl.lol
   ```
   This returns a ready-to-use NWC string. Parse the `lud16` query param — that's the user's **Lightning address** (e.g. `user@getalby.com`). Show it to the user so they know where to receive payments. ⚠️ lncurl wallets cost ~1 sat/hour and die when balance hits 0. Fund via the lightning address to keep alive.

Once you have the NWC string, create `~/.nwc-monitor/config.yml`:

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



## Start

```bash
# systemd
systemctl --user enable --now nwc-monitor

# nohup (no systemd)
bash ~/.nwc-monitor/start.sh
```

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
# systemd
systemctl --user status nwc-monitor     # status
systemctl --user restart nwc-monitor    # restart
journalctl --user -u nwc-monitor -f     # logs

# nohup
cat ~/.nwc-monitor/nwc-monitor.pid      # check pid
tail -f ~/.nwc-monitor/nwc-monitor.log  # logs
bash ~/.nwc-monitor/stop.sh             # stop
```

## Troubleshooting

- **0 wallet monitors** → `nwc` missing in config.yml
- **openclaw not found** → add openclaw to PATH in the .service file
- **service dies on logout** → `sudo loginctl enable-linger $USER`

---
Source: https://github.com/claudiomolt/nwc-monitor
