# `@local/skills-manager` — Skills Manager & Registry Explorer for DeepSeek Harness

Adds a native **Skills Manager** to **Settings ➡️ Skills** and the **Right Sidebar (`Ctrl+Alt+S`)** in DeepSeek Harness (DSH).

## Features

1. **Manage Installed Skills (`Installed` Tab)**
   - Inspect all registered skills across **Global (`~/.dsh/skills`, `~/.agents/skills`)** and **Workspace (`<workspace>/.dsh/skills`, `<workspace>/.agents/skills`)** scopes.
   - One-click **Global** and **Per-Workspace** scope pills to enable/disable a skill globally or in specific workspaces (hot-reloaded immediately via DSH's Chokidar watcher).
   - Toggle **Auto-Invoke** (`disable-model-invocation` in YAML frontmatter).
   - Inline **`SKILL.md` Editor** and **`+ New Skill`** creator.

2. **Import Local Skills from Antigravity & Claude Code (`Import` Tab)**
   - Automatically discovers local skills from:
     - **Antigravity Skills** (`~/.gemini/config/skills`)
     - **Antigravity Built-in** (`~/.gemini/antigravity/builtin/skills`)
     - **Antigravity Plugins** (`~/.gemini/config/plugins/*/skills`)
     - **Claude Code Skills** (`~/.claude/skills`)
   - Full folder copy (`SKILL.md` + `scripts/`, `references/`, `assets/`, `examples/`) into Global (`~/.dsh/skills`) and/or selected DSH Workspaces (`<workspace>/.dsh/skills`), with automatic kebab-case `name` normalization.
   - Supports single-skill and batch import.

3. **Online Skills Registry & Marketplace Search (`Explore & Search Online` Tab)**
   - **Popular (All-Time)**, **Trending (24h)**, and **Hot (Surging)** skills live from `https://skills.sh`.
   - **Newly Created** skills live from GitHub Search API (`api.github.com/search/repositories`).
   - **Search 50,000+ Skills** via `https://skills.sh/api/search?q=<query>` + GitHub fallback.
   - One-click install of any online skill directly into Global and/or selected Workspaces.
