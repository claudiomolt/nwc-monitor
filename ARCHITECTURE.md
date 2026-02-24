# NWC Monitor Architecture

## Core Design: Relay Subscription First

**Primary Mechanism: Nostr Relay Subscription**
- Real-time push notifications via NWCClient.subscribeNotifications()
- Subscribe to NIP-47 payment_received notification events
- Low latency, efficient, event-driven

**Fallback Mechanism: listTransactions Polling**
Used only for:
1. **Initial Startup** - Catch up on payments since last run
2. **Reconnection** - Fill gaps when relay connection is lost
3. **Sanity Check** - Periodic verification (every 60s) to catch missed events

## Implementation Flow

```
WalletMonitor.start()
  ├─> catchUp() [listTransactions from lastSeenTimestamp]
  ├─> subscribe() [NIP-47 notifications on relay]
  └─> startSanityCheck() [periodic 60s listTransactions backup]

On Relay Disconnect:
  ├─> subscriptionActive = false
  ├─> wait retry_delay
  ├─> catchUp() [fill the gap]
  └─> subscribe() [reconnect]
```

## Files

- `src/monitor.ts` - WalletMonitor + NWCMonitor orchestrator
- `src/actions/` - Pluggable action system
- `src/types.ts` - TypeScript definitions
- `src/config.ts` - YAML config loader with multi-wallet support
- `src/index.ts` - CLI entry point

## Multi-Wallet Support

Each wallet has:
- Independent NWC connection
- Own action pipeline
- Separate subscription + fallback polling
- Isolated state (seenHashes, lastSeenTimestamp)

## Actions

Built-in: console, file, sqlite, webhook, email, session-send
Extensible via ActionRegistry
