# AGENTS.md — DeepSeek Harness Plugins (`@local/provider-usage`, `@local/agy-provider` & `@local/skills-manager`)

## 1. Swarm Context & Onboarding (Read First)

Before planning or making non-trivial changes in this workspace:
1. Check if `.swarm/LATEST.txt` exists (note: `/.swarm/` is gitignored and local to the machine).
2. Read the path inside `.swarm/LATEST.txt` (e.g. `.swarm/2026-10-26_101852`), then read:
   - `<latest-run>/AGENT_CONTEXT.md` — architecture map, file responsibilities, key flows, invariants, and step-by-step modification recipes.
   - `<latest-run>/SWARM_MASTER_REPORT.md` — current risk matrix (`R1`–`R10`), cross-domain findings, and refactoring roadmap.
   - `<latest-run>/domains/*.md` — deep-dive reports for the Host backend (`01-host-backend-and-quota-collector.md`) and Client UI (`02-client-ui-and-packaging.md`).

---

## 2. Project Overview & Architecture

This workspace contains two integrated plugin bundles for **DeepSeek Harness (DSH)**, built on the Cordis dependency-injection framework:

### A. `@local/agy-provider` (`agy-provider/`) — Antigravity CLI (`agy`) LLM Provider
- **Host Runtime (`agy-provider/index.js`)**:
  - Registers the `agy-cli` ("Antigravity CLI (agy)") provider route directly into DSH's `ctx.llm` service (`registerAdapter`).
  - **Login-Gated Model Visibility**: Advertises 26 models **only when at least one `agy` account is signed in and toggled active** (`accountManager.hasActiveAccount()`): all 13 standard Antigravity CLI models (`gemini-4-argon-*`, `gemini-3.8-flash-*`, `claude-opus-5-5-*`, `claude-sonnet-5-5-*`, `gpt-oss-120b-medium`) plus 13 **`[agy] ...`** autonomous agent presets (`agy/<model-id>`), with 5 reasoning effort levels (`low`, `medium`, `high`, `xhigh`, `max`). Returns `[]` when signed out or toggled off.
  - **Multi-Account OAuth Manager (`AgyAccountManager`, `/api/agy-provider.accounts`)**:
    - Persists multiple Google OAuth account profiles in `~/.dsh/storages/agy-provider-accounts.json` and swaps the active credential in Windows Credential Manager (`gemini:antigravity` via `CredReadW` / `CredWriteW` / `CredDeleteW`).
    - Supports interactive browser OAuth sign-in (`start-login`), terminal CLI session import (`sync-current`), active account switching (`activate` / `toggle-account`), master toggle (`toggle-provider`), and account removal (`remove`), firing `adapterHandle.replace(['agy-cli'])` (`llm/adapters-updated`) on every change.
  - **Dual-Mode Execution**:
    1. `dsh-bridge` (Default): `agy` acts as the LLM inference & reasoning engine while delegating tool execution (`<dsh_tool_call>`) back to DSH so native DSH UI tools, file diff reviews, terminal panes, and approvals work seamlessly.
    2. `agy-agent` (`[agy]` Autonomous Agent Mode, inspired by `tm-agy-tele`): `agy` runs with `--dangerously-skip-permissions` and `--conversation <id>` session persistence (`~/.dsh/storages/agy-provider-sessions.json`, scoped per active account), executing its own tools and streaming live reasoning/actions to DSH.
  - **Live `stream-json` + `transcript.jsonl` Streaming & Recovery**:
    - Streams real-time token deltas from `--output-format stream-json`, extracts model `thinking` from `~/.gemini/antigravity-cli/brain/<conv_id>/.system_generated/logs/transcript.jsonl` (and `transcript_full.jsonl`), and recovers final responses if stdout is empty or times out.
    - Terminates the entire `agy` process tree via `taskkill.exe /T /F /PID` on Windows when a DSH turn is aborted.
- **Client Runtime (`agy-provider/client.js`)**:
  - Mounts inside **Settings -> Models** via the `settings.models.footer` slot (`@deepseek-ai/dsh-client-ui-settings-models`).
  - Renders the **Antigravity CLI (`agy`) Multi-Account Card** with `+ Add Account` (interactive Google OAuth), `Sync CLI`, master toggle switch, and per-account active toggle/delete controls.

### B. `@local/provider-usage` (`provider-usage/`) — Live Provider Quota Telemetry
- **Host Runtime (`provider-usage/index.js`)**:
  - Discovers configured LLM providers and the active model from `settings`, `llm`, and `agentDefaultModel`.
  - Resolves provider API keys (`NINE_ROUTER_API_KEY`, `DATTIO_AI_API_KEY`, etc.) server-side via `ctx.get('credentials').resolve()`.
  - Probes candidate upstream quota endpoints and normalizes responses for multi-provider aggregators (**9Router**), single-provider token counters (**Dattio AI**), and native **Antigravity CLI (`agy-cli`)** via `agy -p /usage --output-format json`.
  - Exposes the Web UI Fetch route `GET /api/provider-usage.quota` and the in-chat LLM agent tool `provider_usage`.
- **Client Runtime (`provider-usage/client.js`)**:
  - Loaded in the browser via `window.__ModuleLoader__.load` using pure `React.createElement` (`const h = React.createElement`) with zero build step.
  - Renders three integrated UI surfaces:
    1. **Composer Dock Pill** (`conversation.composer.dock`, id `provider-usage`, order `2`)
    2. **Right Sidebar Tab** (`sidebar.right.pane.tab`, id `@local/provider-usage/tab`, kind `provider-quota`, shortcut `Ctrl+Alt+B`)
    3. **Settings Section** (`settings.section`, id `provider-quota`, order `12`)
- **Manifests & Localization**:
  - `provider-usage/package.json` — package exports and `dsh.client.inject` dependencies.
  - `provider-usage/cordis.patch.yml` — declarative Cordis loader insertion and default plugin config.
  - `provider-usage/locale/en.json` & `provider-usage/locale/id.json` — bundle metadata translations (`en` and `id`).

### C. `@local/skills-manager` (`skills-manager/`) — Skills Manager, Local Importer & Online Registry
- **Host Runtime (`skills-manager/index.js`)**:
  - Exposes `GET` & `POST /api/skills-manager` and the `skills_manager` in-chat LLM tool.
  - Discovers registered DSH workspaces from `~/.dsh/storages/workspace.json`.
  - Scans and manages installed skills across Global (`~/.dsh/skills`, `~/.agents/skills`) and Workspace (`<workspace>/.dsh/skills`, `<workspace>/.agents/skills`) directories with full folder copy (`SKILL.md` + `scripts/`, `references/`, `assets/`, `examples/`) and strict kebab-case `name` normalization.
  - Auto-discovers importable local skills from **Antigravity** (`~/.gemini/config/skills`, `~/.gemini/antigravity/builtin/skills`, `~/.gemini/config/plugins/*/skills`) and **Claude Code** (`~/.claude/skills`).
  - Queries `https://skills.sh` (`Popular`, `Trending 24h`, `Hot`), `https://skills.sh/api/search?q=...` (50,000+ skills), and GitHub Search API (`Newly Created` + repository fallback) and installs remote skills from GitHub (`owner/repo/skillId`) into Global and/or selected Workspaces.
- **Client Runtime (`skills-manager/client.js`)**:
  - Registers **Settings -> Skills** (`settings.section`, id `skills-manager`, order `11`) and a **Right Sidebar Tab** (`@local/skills-manager/tab`, kind `skills-manager`, shortcut `Ctrl+Alt+S`).
  - Provides 3 tabs: **Installed**, **Import (Antigravity / Claude)**, and **Explore & Search Online**, plus inline `SKILL.md` editor and `+ New Skill` modal.

---

## 3. Core Invariants & Engineering Rules

1. **Secret Isolation**: Provider API keys resolved from `ctx.get('credentials')` in `provider-usage/index.js` must **never** be included in snapshots, error payloads, logs, or responses sent to the Web client or LLM tool output.
2. **Route & Slot Synchronization**:
   - Host route `ROUTE_PATH = '/api/provider-usage.quota'` (`provider-usage/index.js`) and Client relative route `ROUTE = 'api/provider-usage.quota'` (`provider-usage/client.js`) must remain strictly aligned.
   - Right Sidebar keyed slots (`sidebar.right.pane.tab` and `sidebar.right.pane.tab.title`) must use `key: SIDEBAR_TAB_ID` (`@local/provider-usage/tab`).
3. **Zero Build Step on Client**: `provider-usage/client.js` runs directly in the browser. Do not introduce JSX syntax, TypeScript syntax, or external npm runtime imports not provided by the DSH host `require`.
4. **Theme Token Compliance**: Use `--dsw-alias-*` CSS custom properties exclusively for all colors, borders, and surfaces in `provider-usage/client.js`.
5. **Quota Percentage Polarity**:
   - **Aggregated (9Router)** reports *remaining* percentage (`remainingPercentage`: high is healthy, `<25%` is error via `toneForRemaining`).
   - **Single (Dattio AI)** reports *used* percentage (`usagePercent`: low is healthy, `>=90%` is error via `toneForUsed`).
   - Never mix `toneForRemaining` and `toneForUsed`.
6. **Bilingual UI Support (`en` & `id`)**: Every user-visible string in `provider-usage/client.js` and `agy-provider/client.js` must be defined in both `DICTIONARIES.en` and `DICTIONARIES.id` and accessed through `t('<key>')`.
7. **Client HTTP Fetching (`fetch` vs `ctx.remote`)**:
   - `ctx.remote` in `dsh-web` only exposes RPC namespaces (`ctx.remote.llm`, `ctx.remote.settings`, `$on`) and does **not** expose `ctx.remote.$fetch`.
   - Custom endpoints registered via `connection.fetch.register({ path: '/api/...' })` must always be called from `client.js` using standard browser `fetch(new URL(ROUTE, document.baseURI).href, { credentials: 'same-origin', cache: 'no-store' })`.
8. **Host vs Client Reload Protocol on Windows**:
   - Reloading the webview (`Ctrl+R`) only reloads client modules (`client.js`).
   - Closing the DeepSeek Harness window via the `X` button keeps the background `dsh-desktop-host` process (`DeepSeek Harness.exe`) alive in the system tray. Whenever host backend files (`index.js`, `package.json`, `cordis.patch.yml`) are modified, restart the full process tree via:
     `Stop-Process -Name "DeepSeek Harness" -Force; Start-Process "$env:LOCALAPPDATA\Programs\DeepSeek Harness\DeepSeek Harness.exe"`
9. **Right Sidebar Registration & Cordis `inject` Contract**:
   - Client plugins registering a Right Sidebar tab must explicitly include `'sidebarRight'` and `'sidebarRightTabs'` in their returned Cordis `inject: ['slots', 'locale', 'sidebarRight', 'sidebarRightTabs']` array so `apply(ctx)` only executes after `@deepseek-ai/dsh-client-ui-sidebar-right` has provided both services.
   - Never call `ctx.layout.openRightbar(true, false)` directly as a fallback—`layout.openRightbar` is an internal geometry callback driven by `RightbarSeat`. Calling it directly opens a blank 50% right column while `RightbarSeat` remains collapsed (`aria-hidden="true"`). Always open Right Sidebar tabs via `ctx.sidebarRight.openTab(kind)`.
10. **Windows PowerShell 5.1 UTF-8 BOM Guard**:
    - Never use `Set-Content -Encoding UTF8` in PowerShell 5.1 to write JSON files (`package.json`, etc.) consumed by Node.js, because PowerShell 5.1 prepends a 3-byte UTF-8 BOM (`0xEF 0xBB 0xBF` / `\uFEFF`) which crashes `JSON.parse()` at startup. Always use `[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))`.
