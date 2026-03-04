# ClawDeck

<p align="center">
  <img src="./public/readme/hero-banner.svg" alt="ClawDeck Hero Banner" width="100%" />
</p>

<p align="center">
  <strong>Mission Control UI for PicoClaw</strong><br />
  Local-first, Windows-first, safe controls, no terminal required.
</p>

<p align="center">
  <a href="https://github.com/aamsuzon/ClawDeck/stargazers"><img src="https://img.shields.io/github/stars/aamsuzon/ClawDeck?style=for-the-badge" alt="GitHub stars" /></a>
  <a href="https://github.com/aamsuzon/ClawDeck/releases"><img src="https://img.shields.io/github/v/release/aamsuzon/ClawDeck?style=for-the-badge" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" />
</p>

## Why ClawDeck

PicoClaw is powerful, but many users do not want to run everything from terminal commands.

ClawDeck gives you a visual control center:
- Live gateway health and workspace status
- Mission timeline for sessions, tool calls, and cron activity
- No-CLI actions (send agent messages, restart gateway, manage cron)
- Safe Config Studio with secret masking and approval flow
- Version update notifications from GitHub releases

## Product Visuals

<p align="center">
  <img src="./public/readme/mission-timeline.svg" alt="Mission Timeline UI" width="100%" />
</p>

<p align="center">
  <img src="./public/readme/config-studio.svg" alt="Config Studio UI" width="100%" />
</p>

<p align="center">
  <img src="./public/readme/update-center.svg" alt="Version Update Notice UI" width="100%" />
</p>

## Feature Highlights

### 1) Mission Timeline
- Paginated timeline for large conversations
- Long message "Load more / Show less"
- Tool-call payload inspection

### 2) Action Console
- Send message to agent from UI
- Restart gateway from UI (high-risk confirmation)
- Create/enable/disable/remove cron jobs

### 3) Config Studio (No JSON Editing Required)
- Messaging channel list with enabled/token status
- Token field selector for different bot types (`token`, `bot_token`, `app_token`, etc.)
- AI model profile create/update (provider + model id + API base + API key)
- Masked secret display for safe local operations

### 4) Update Awareness
- Shows current app version in header
- Checks latest release from GitHub API
- In-app "new update available" notice

## Quick Start (Windows)

### Prerequisites
1. Node.js `20+`
2. PicoClaw installed (`C:\picoclaw\picoclaw.exe`)
3. PicoClaw config and workspace in:
   - `C:\Users\<your-user>\.picoclaw\config.json`
   - `C:\Users\<your-user>\.picoclaw\workspace`

### Install

```powershell
cd C:\Projects
git clone https://github.com/aamsuzon/ClawDeck.git
cd ClawDeck
npm install
```

### Run

```powershell
npm run dev
```

Open: `http://localhost:3000`

### Production Build

```powershell
npm run build
npm run start
```

## First-Time Setup Flow

1. Start PicoClaw gateway.
2. Open ClawDeck and click `Refresh`.
3. Confirm `Gateway Online` and `Workspace Ready`.
4. Go to `Configuration Center`:
   - Set messaging token/channel config
   - Set AI model API key config
5. Test using `Action Console -> Run Agent`.
6. Add cron jobs from the UI if needed.

## API Surface (Bridge + UI Meta)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/bridge/health` | Gateway and workspace status |
| GET | `/api/bridge/sessions` | Session list |
| GET | `/api/bridge/sessions/:id` | Session detail + messages |
| GET | `/api/bridge/cron` | Cron job list |
| POST | `/api/bridge/cron` | Create cron job |
| PATCH | `/api/bridge/cron/:id` | Enable/disable/remove cron job |
| POST | `/api/bridge/agent/message` | Send agent message |
| GET | `/api/bridge/config/safe` | Redacted raw config |
| GET | `/api/bridge/config/ui` | Structured config data for UI |
| PUT | `/api/bridge/config/ui/messaging` | Update messaging config |
| PUT | `/api/bridge/config/ui/model` | Update/create model profile |
| POST | `/api/bridge/gateway` | Gateway control actions |
| GET | `/api/meta/version` | Current vs latest GitHub release |

## Security Model

- Localhost-focused bridge routes
- Redacted secrets in safe config responses
- No raw arbitrary shell execution from UI
- Risk-classified operations with explicit confirmation (`force: true`)

## Update Notification Setup

By default, update check targets:
- `aamsuzon/clawdeck`

To change repository source:

```powershell
# temporary (current shell)
$env:CLAWDECK_GITHUB_REPO="owner/repo"

# permanent (new shells)
setx CLAWDECK_GITHUB_REPO "owner/repo"
```

## Troubleshooting

### Gateway shows offline
- Confirm PicoClaw is running.
- Check `config.json` gateway host/port.
- Click `Refresh`.

### Messaging token shows not set
- Select the correct channel in Config Studio.
- Select the correct token field.
- Save config with confirmation.

### Cannot push to GitHub
- Use HTTPS remote and GitHub login prompt, or configure SSH key.

## Roadmap (Public)

- Better onboarding wizard for non-technical users
- Deeper channel diagnostics
- Enhanced timeline filters and search
- Contributor-friendly plugin extensions

## Contributing

Issues and pull requests are welcome.

1. Fork repository
2. Create feature branch
3. Commit with clear message
4. Open pull request

## Credit

Built by **Aam Suzon**

- Facebook: https://facebook.com/aamsuzon
- GitHub: https://github.com/aamsuzon
- LinkedIn: https://www.linkedin.com/in/aamsuzon/

If this project helps you, please star the repository and follow for updates.
