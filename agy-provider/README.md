# `@local/agy-provider` — Antigravity CLI (`agy`) LLM Provider for DeepSeek Harness

Native DeepSeek Harness (`dsh`) LLM provider plugin that integrates **Google Antigravity CLI (`agy.exe` / `agy`)** directly into DSH's `ctx.llm` runtime (`registerAdapter` & `registerConfigurableProviders`).

## Key Features

1. **First-Class `LlmAdapter` Integration (`agy-cli`)**:
   - Registers `agy-cli` ("Antigravity CLI (agy)") directly in DeepSeek Harness with zero external HTTP proxy processes required.
   - Automatically discovers all models from `agy models` (`gemini-4-argon-*`, `gemini-3.8-flash-*`, `claude-opus-5-5-*`, `claude-sonnet-5-5-*`, `gpt-oss-120b-medium`) and exposes reasoning effort controls (`low`, `medium`, `high`, `xhigh`, `max`).

2. **Dual-Mode Execution**:
   - **DSH-Native Tool Bridge Mode (`mode: "dsh-bridge"`, default)**:
     `agy` acts as the LLM inference & reasoning engine while delegating tool execution (`<dsh_tool_call>`) back to DeepSeek Harness so native DSH UI features (file diff review, terminal pane, tool approvals, MCP) work seamlessly.
   - **Autonomous `agy` Agent Mode (`mode: "agy-agent"` or `[Agent] ...` model presets, inspired by `tm-agy-tele`)**:
     `agy` runs with `--dangerously-skip-permissions` and executes its own tools directly in the workspace while maintaining multi-turn session state via `--conversation <id>`.

3. **Live `stream-json` + `transcript.jsonl` Reasoning & Recovery**:
   - Streams token deltas from `--output-format stream-json` in real time.
   - Extracts model `thinking` blocks from `~/.gemini/antigravity-cli/brain/<conv_id>/.system_generated/logs/transcript.jsonl` (and `transcript_full.jsonl` when `truncated_fields` is present) and streams them as DSH `reasoning-delta` chunks.
   - Automatically recovers the final `PLANNER_RESPONSE` from `transcript.jsonl` if stdout is empty or times out.
   - Cleanly terminates the entire `agy` process tree (`taskkill /T /F /PID` on Windows) when a turn is cancelled in the DSH UI.

4. **Live Quota Integration with `@local/provider-usage`**:
   - Works out-of-the-box with `@local/provider-usage` (`agy -p /usage --output-format json`) to display real-time Gemini and Claude/GPT 5-Hour & Weekly quota bars in the Composer Pill, Right Sidebar (`Ctrl+Alt+B`), and Settings.
