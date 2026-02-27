# NWC Monitor — 2026 Roadmap

**Created:** 2026-02-26  
**Target Completion:** March 2026

## 📋 Overview

**NWC Monitor** is a complete Lightning Network wallet toolkit for OpenClaw agents. Enables agents to:
- Send & receive payments via Lightning Address
- Manage invoices + balances
- Trigger actions on payment events (webhooks, emails, console, database, file writes, agent notifications)
- Use NWC (preferred) or lncurl (fallback)

**Core Technologies:** Lightning Address + Nostr Wallet Connect (NWC)

**Use Cases:**
- Agents with autonomous funding (receive donations, tips, bounties)
- Payment-gated agent features
- Notification of important events
- Integration with external systems (Slack, Discord, databases)

## 🎯 Deliverables

### 1. Landing Page
- **URL:** https://nwc-monitor.claudio.solutions (or new domain)
- **Content:** Feature showcase, use cases, quick-start guide, demo
- **Sections:**
  - Hero: "Lightning Wallet Toolkit for Agents"
  - Features: Send, Receive, Invoices, Notifications
  - Actions: Webhooks, Email, Console, Database, Files, Agent Notifications
  - Tech Stack: NWC + Lightning Address
  - Installation CTA: "1-minute setup"
  - Demo/Examples: Code snippets
- **Tech:** React (design-heavy, showcase)
- **Effort:** 6-8 hours

### 2. OpenClaw Skill: NWC Monitor
- **Purpose:** Complete Lightning wallet management in OpenClaw
- **CLI Commands:**
  - `openclaw nwc-monitor setup` — Configure wallet (NWC or lncurl)
  - `openclaw nwc-monitor send <amount> <address>` — Send sats
  - `openclaw nwc-monitor invoice <amount> [description]` — Create invoice
  - `openclaw nwc-monitor balance` — Check balance
  - `openclaw nwc-monitor listen` — Watch for incoming payments
  - `openclaw nwc-monitor action add <trigger> <type> <payload>` — Setup action
- **Core Features:**
  - **Send/Receive:** Via Lightning Address (NIP-57)
  - **Balance:** Real-time sats check
  - **Invoices:** Generate + track
  - **Notifications:** Payment events
  - **Actions:** Trigger on payments:
    - Webhook POST
    - Email notification
    - Console log
    - Database insert
    - File write
    - Agent notification
  - **Dual Mode:** NWC (primary) + lncurl fallback
- **Dependencies:** 
  - @getalby/client-js (NWC)
  - lncurl (fallback)
  - OpenClaw SDK
- **Effort:** 12-15 hours

### 3. Installation Instructions & Docs
- **Format:** Interactive CLI guide + comprehensive docs
- **Docs Sections:**
  - README.md (overview + quick start)
  - INSTALL.md (5-step setup)
  - API.md (all commands + examples)
  - ACTIONS.md (trigger types + payloads)
  - EXAMPLES.md (code samples for each use case)
  - TROUBLESHOOTING.md (common issues)
  - FAQ.md
- **Steps:**
  1. Install @getalby/cli (or setup NWC manually)
  2. Create Lightning Address (or use existing)
  3. Configure NWC connection (via Alby or direct)
  4. Install openclaw skill: `npm install -g openclaw-nwc-monitor`
  5. Run setup wizard: `openclaw nwc-monitor setup`
  6. Test with `openclaw nwc-monitor balance`
  7. Configure actions as needed
- **Target Audience:** Developers + non-technical users
- **Effort:** 6-8 hours

## 📅 Schedule

**Today (2026-02-26):**
- [ ] ROADMAP.md updated with full specs

**Tomorrow (2026-02-27) — 2-3 hour session:**
1. **Repo Audit** (30 min)
   - Review existing nwc-monitor code
   - Understand current architecture
   - Identify gaps vs. requirements

2. **Design Phase** (90 min)
   - Landing page wireframes (Figma)
   - Skill CLI structure (command map)
   - Action system architecture
   - Config/storage strategy

3. **GitHub Issues** (30 min)
   - Create 5-7 issues with acceptance criteria
   - Assign effort estimates
   - Define dependencies

**Week 1 (Feb 27 - Mar 5) — 20-24 hours:**
- [ ] Landing page (6-8h)
- [ ] Skill core + NWC integration (12-15h)
- [ ] Initial documentation (4-6h)

**Week 2 (Mar 6 - Mar 12) — 16-20 hours:**
- [ ] Actions system (webhooks, email, DB, etc) (8-10h)
- [ ] Complete documentation (4-6h)
- [ ] Testing + bug fixes (4-6h)

**Week 3 (Mar 13 - Mar 15) — 8-12 hours:**
- [ ] Final testing
- [ ] Production deployment
- [ ] Launch announcement

**Target Go-Live:** March 15, 2026 (1 week after OpenClaw Meetup #2)

## 🔧 Tech Stack

### Landing Page
- **Framework:** React 19 (design-first)
- **Styling:** Tailwind CSS + custom components
- **Hosting:** Vercel (auto-deploy from GitHub)
- **Design:** Figma mockups (to create)

### Skill Package
- **Language:** TypeScript 5.x
- **Runtime:** Node.js 18+
- **Package Manager:** npm
- **CLI Framework:** commander.js (for structured commands)
- **Config:** JSON + environment variables
- **Core Dependencies:**
  - `@getalby/sdk` (NWC protocol)
  - `lncurl` (Lightning URL fallback)
  - `axios` (HTTP requests for webhooks)
  - `commander.js` (CLI)
  - `chalk` (colored output)
  - `ora` (spinners)
- **Dev Deps:**
  - `vitest` (testing)
  - `@types/node`

### Documentation
- **Format:** Markdown + code snippets
- **Hosting:** GitHub docs + landing page
- **Examples:** TypeScript + JavaScript + bash

### Data Storage
- **NWC Config:** ~/.openclaw/nwc-monitor.json (encrypted)
- **Actions:** ~/.openclaw/nwc-monitor/actions.json
- **Payment History:** ~/.openclaw/nwc-monitor/payments.json
- **Optional:** Supabase for cloud sync (future)

## 📊 Success Criteria

### Landing Page
- [ ] Loads in <2s (Lighthouse ≥85)
- [ ] Mobile responsive (tested)
- [ ] Clear CTA to installation
- [ ] Feature showcase with examples
- [ ] No broken links

### Skill
- [ ] Installable: `npm install -g openclaw-nwc-monitor`
- [ ] All CLI commands work: send, receive, balance, invoice, listen
- [ ] NWC integration functional
- [ ] lncurl fallback works
- [ ] Actions trigger correctly (all 6 types)
- [ ] Payment notifications working
- [ ] Config encryption working
- [ ] Error messages helpful + actionable
- [ ] <5 minute initial setup

### Documentation
- [ ] All commands documented + examples
- [ ] Installation guide <10 minutes follow
- [ ] At least 3 complete use-case examples
- [ ] Troubleshooting covers top 5 issues
- [ ] API docs cover all endpoints/methods

### Testing
- [ ] Tested on Linux, macOS, Windows (WSL)
- [ ] NWC connection tested with Alby
- [ ] lncurl fallback tested
- [ ] Payment notifications tested
- [ ] All action types tested
- [ ] No console errors
- [ ] Zero security issues (no credentials in logs)

## 🔗 Related Projects

- `lacrypta/nwc-monitor` (main repo)
- `openai-whisper-api` (skill example)
- `daily-cost-report` (skill example)

## 🏗️ Architecture Overview

### Skill Package Structure
```
openclaw-nwc-monitor/
├── bin/
│   └── nwc-monitor.js          # CLI entry point
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── send.ts         # Send payment
│   │   │   ├── receive.ts      # Create invoice
│   │   │   ├── balance.ts      # Check balance
│   │   │   ├── listen.ts       # Watch payments
│   │   │   ├── action.ts       # Manage actions
│   │   │   └── setup.ts        # Configuration
│   │   └── index.ts            # CLI router
│   ├── wallet/
│   │   ├── nwc.ts             # NWC implementation
│   │   ├── lncurl.ts          # lncurl fallback
│   │   └── types.ts           # Wallet interface
│   ├── actions/
│   │   ├── webhook.ts         # Webhook trigger
│   │   ├── email.ts           # Email trigger
│   │   ├── console.ts         # Console trigger
│   │   ├── database.ts        # Database trigger
│   │   ├── file.ts            # File write trigger
│   │   ├── agent.ts           # Agent notification
│   │   └── executor.ts        # Action dispatcher
│   ├── config/
│   │   ├── manager.ts         # Config CRUD
│   │   └── validator.ts       # Validation
│   ├── payments/
│   │   ├── listener.ts        # Payment watcher
│   │   └── history.ts         # Payment log
│   └── utils/
│       ├── crypto.ts          # Encryption
│       └── logger.ts          # Logging
├── docs/
│   ├── README.md
│   ├── INSTALL.md
│   ├── API.md
│   ├── ACTIONS.md
│   ├── EXAMPLES.md
│   └── TROUBLESHOOTING.md
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
└── tsconfig.json
```

### Data Flow
```
Payment Event (NWC/lncurl)
    ↓
Payment Listener
    ↓
Notification + Log
    ↓
Trigger Actions
    ├→ Webhook POST
    ├→ Email
    ├→ Console log
    ├→ Database insert
    ├→ File append
    └→ Agent notification
```

## 🚀 Key Features

### 1. Wallet Management
- **NWC (Primary):** Direct Nostr Wallet Connect integration
- **lncurl (Fallback):** For users without NWC setup
- **Lightning Address:** Send/receive via NIP-57
- **Balance:** Real-time satoshi check

### 2. Payment Handling
- **Invoices:** Create + track with descriptions
- **Send:** Direct payments to Lightning addresses
- **Receive:** Incoming payment notifications
- **History:** All transactions logged locally

### 3. Action System
Triggered on each incoming payment:
- **Webhook:** POST event to any URL
- **Email:** Send confirmation/notification
- **Console:** Log to stdout
- **Database:** Insert record (PostgreSQL, Supabase, etc)
- **File:** Append transaction to file
- **Agent:** Notify OpenClaw agent (custom action)

### 4. Configuration
- Interactive setup wizard
- Encrypted credential storage
- Per-action configuration
- Environment variable override

## 📝 Next Steps

1. **Tomorrow 9 AM (2026-02-27):** Design session
   - [ ] Review nwc-monitor repo
   - [ ] Finalize architecture
   - [ ] Create detailed wireframes
   - [ ] Plan GitHub issues

2. **Create GitHub Issues (5-7):**
   - Landing page
   - Skill core + NWC
   - Actions system
   - Documentation
   - Testing + QA

3. **Implementation Kickoff** (Week of Mar 3)
   - [ ] Start landing page
   - [ ] Begin skill development
   - [ ] Setup test environment

4. **Beta Testing** (Week of Mar 10)
   - [ ] Internal testing with Agustin
   - [ ] Documentation review
   - [ ] Performance tuning

5. **Launch** (Mar 15)
   - [ ] Production deployment
   - [ ] Announcement
   - [ ] Community feedback

---

**Owner:** Claudio  
**Stakeholder:** Agustin (@agustinkassis)  
**Status:** 📋 PLANNING  
**Last Updated:** 2026-02-26 (Updated with full specs)