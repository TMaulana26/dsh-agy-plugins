# Provider Usage

A DeepSeek Harness (DSH) bundle that surfaces live token quotas, rolling rate limits, and reset schedules of configured AI model providers across **Settings**, the **Right Sidebar (`Ctrl+Alt+B`)**, and the **Conversation Composer Dock**.

## Supported Providers

- **Multi-Provider Aggregators** (e.g. **9Router**):
  - Fetches from `https://9router.mtim.my.id/quota`.
  - Normalizes sub-providers: Google Antigravity, CommandCode, Groq, etc.
  - Automatically highlights the quota bucket for your active session model (e.g. `Gemini 3.8 Flash (Medium)` or 5-hour rolling session limit).
  - Displays remaining percentages, token/request counts, and live countdowns to limit resets (`resets in 4h 8m`).
- **Single-Provider Token Quota** (e.g. **Dattio AI**):
  - Fetches from `https://bandelbanget.xyz/v1/quota`.
  - Normalizes token ceiling, tokens remaining, percentage used, breakdown (prompt, completion, cached tokens), requests count, and account expiration.
- **Provider Switcher**:
  - Automatically detects the active model's provider (`provider: auto`).
  - Seamlessly toggle between multiple configured providers (`9Router` / `Dattio AI`) directly in the UI.

## Architecture

- **Host half** (`index.js`):
  - Discovers active provider and model from `agentDefaultModel` and `settings`.
  - Resolves provider API key securely from `ctx.credentials` (`NINE_ROUTER_API_KEY`, `DATTIO_AI_API_KEY`). The secret never leaves the Host process.
  - Automatically tests candidate quota URLs (handling `/v1/quota` vs root `/quota`).
  - Exposes an exact `/api/provider-usage.quota` Fetch route for the Web client.
  - Registers the `provider_usage` agent tool for direct in-chat inspection.
- **Client half** (`client.js`):
  - **Composer Dock Pill** (`conversation.composer.dock`, `id: provider-usage`, order: 2): compact status badge with tone dot, active model quota percentage, rich multi-line tooltip, and one-click opener for the Right Sidebar.
  - **Right Sidebar Tab** (`sidebar.right.pane.tab`, `id: @local/provider-usage/tab`, shortcut `Ctrl+Alt+B`): full dashboard of sub-providers, individual model quota buckets, cache indicators, and provider switching tabs.
  - **Settings Section** (`settings.section`, `id: provider-quota`, order: 12): dedicated "Quota & Usage" dashboard inside DSH Settings.
  - Shared singleton state store across all mounted surfaces with automatic `AbortController` request cancellation and `--dsw-alias-*` design token compliance.

## Configuration

In `cordis.patch.yml`:

```yaml
- id: provider-usage
  name: "@local/provider-usage"
  config:
    provider: auto             # 'auto' tracks active model; or 'nine-router' / 'dattio-ai'
    quotaPath: /quota          # appended to provider baseURL
    quotaURL: ""               # optional absolute override
    baseURL: ""                # optional baseURL override
    apiKeyEnv: ""              # optional credential ref override
    refreshSeconds: 60
    timeoutMs: 10000
    cacheMs: 5000
```
