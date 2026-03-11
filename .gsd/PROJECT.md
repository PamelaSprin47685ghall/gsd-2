# Project

## What This Is

GSD 2.0 is a branded npm CLI (`npm install -g gsd-pi`) that ships the full GSD coding agent experience as a standalone product. It embeds `@mariozechner/pi-coding-agent` via SDK, stores state in `~/.gsd/`, bundles the GSD extension, all supporting extensions, agents, and AGENTS.md context, and runs pi's `InteractiveMode` under the `gsd` brand. Users run `gsd` — not `pi`.

## Core Value

A single `npm install -g gsd-pi` gives any developer a fully configured, GSD-branded coding agent with the GSD extension, all supporting tools (browser, search, context7, subagent, bg-shell, etc.), and a first-run setup wizard that collects API keys — ready to use in under two minutes.

## Current State

M001/S01, S02, and S03 complete. `gsd` binary compiles and launches with "gsd" TUI branding. All 11 bundled extensions load without errors. State goes to `~/.gsd/`. `~/.pi/` is untouched. AGENTS.md auto-deployed to `~/.gsd/agent/` on first launch. First-run wizard fires for missing optional keys (Brave/Context7/Jina), stores them with masked input, and skips on subsequent launches. Only S04 (npm publish and install smoke test) remains.

Key structural artifact: `pkg/` shim directory — `PI_PACKAGE_DIR` points here (not project root) to avoid pi's `getThemesDir()` collision with our real `src/` dir. Committed; `pkg/dist/modes/interactive/theme/` populated by `npm run copy-themes` at build time.

## Architecture / Key Patterns

- **SDK embedding**: `@mariozechner/pi-coding-agent` imported as a library via `createAgentSession` + `InteractiveMode`
- **Branded app directories**: state lives in `~/.gsd/agent/`, sessions in `~/.gsd/sessions/` (constants in `src/app-paths.ts`)
- **Branding via `PI_PACKAGE_DIR`**: env var set in `src/loader.ts` before any pi SDK loads; points to `pkg/` shim; `pkg/package.json` declares `piConfig: { name: "gsd", configDir: ".gsd" }`
- **Two-file loader pattern**: `loader.ts` (sets env vars, zero SDK imports, dynamic-imports `cli.js`) → `cli.ts` (static SDK imports, wires all managers)
- **pkg/ shim**: lean subdirectory — only `package.json` (piConfig) and `dist/modes/interactive/theme/` (pi theme assets). No `src/`. Avoids `getThemesDir()` src-check collision.
- **Bundled extensions**: GSD extension + 10 supporting extensions in `src/resources/extensions/`; loaded via `buildResourceLoader()` → `DefaultResourceLoader.additionalExtensionPaths`; all 11 load clean on launch
- **Bundled agents + AGENTS.md**: scout, researcher, worker in `src/resources/agents/`; `initResources()` writes bundled AGENTS.md to `~/.gsd/agent/` on first launch (existsSync guard)
- **4 GSD_ env vars**: set in loader.ts before cli.js loads — `GSD_CODING_AGENT_DIR`, `GSD_BIN_PATH`, `GSD_WORKFLOW_PATH`, `GSD_BUNDLED_EXTENSION_PATHS`
- **First-run wizard**: `src/wizard.ts` — detects missing optional keys (Brave/Context7/Jina), prompts with masked TTY input, writes to `~/.gsd/agent/auth.json`; `loadStoredEnvKeys` hydrates env on every launch before extensions load

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: MVP CLI — `npm install -g gsd-pi` installs, launches, and runs with all bundled extensions and first-run setup
- [ ] M003: AI-Driven Test Flows — intent-based YAML test specs the agent writes during development and executes autonomously at UAT time (browser, mac, api targets)
