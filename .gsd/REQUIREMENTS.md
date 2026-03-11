# Requirements

This file is the explicit capability and coverage contract for GSD 2.0.

## Active

### R001 — Single-command install

- Class: primary-user-loop
- Status: validated
- Description: `npm install -g gsd-pi` installs the gsd CLI and all bundled resources in a single command with no additional manual steps required
- Why it matters: The whole product promise is zero-friction install. If install requires manual steps, the product fails its core pitch.
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: M001/S04
- Validation: S04 — npm install -g gsd-pi from registry installs working binary; zero extension load errors; R001 fully validated

### R002 — Branded identity

- Class: differentiator
- Status: validated
- Description: The CLI is named `gsd`, state lives in `~/.gsd/`, the TUI header shows "gsd", and no pi branding is visible to the user in normal operation
- Why it matters: GSD 2.0 is a product, not a pi config. Users should experience a coherent branded tool.
- Source: user
- Primary owning slice: M001/S01
- Supporting slices: none
- Validation: S01 — TUI header confirmed "gsd" via live runtime launch; piConfig.name=gsd, piConfig.configDir=.gsd verified; ~/.gsd/ confirmed created

### R003 — Bundled GSD extension

- Class: core-capability
- Status: validated
- Description: The `/gsd` command, auto-mode, GSD dashboard (Ctrl+Alt+G), and all GSD workflow commands work out of the box with no additional configuration
- Why it matters: The GSD extension is the primary reason users install this tool.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: S02 — gsd extension loads without errors on launch (zero stderr extension errors confirmed); interactive /gsd command use deferred to S04 UAT

### R004 — Bundled supporting extensions

- Class: core-capability
- Status: validated
- Description: All extensions from `~/.pi/agent/extensions/` ship bundled: browser-tools, search-the-web, context7, subagent, bg-shell, worktree, plan-mode, slash-commands, ask-user-questions, get-secrets-from-user
- Why it matters: These extensions are what make the agent useful as a coding agent. GSD without browser tools, web search, and subagent is significantly less capable.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: S02 — all 10 supporting extensions load without errors (zero stderr extension errors on launch); functional tool use (browser launch, web search) deferred to S04 UAT

### R005 — Bundled agents and AGENTS.md

- Class: core-capability
- Status: validated
- Description: The scout, researcher, and worker agents are bundled and available. The AGENTS.md hard rules and execution heuristics are loaded as the default agent context.
- Why it matters: Agents and AGENTS.md define how the model behaves. Without them, subagent delegation and model discipline don't work.
- Source: user
- Primary owning slice: M001/S02
- Supporting slices: none
- Validation: S02 — scout.md, researcher.md, worker.md present in src/resources/agents/; AGENTS.md (15,070 bytes) written to ~/.gsd/agent/ on first launch via initResources()

### R006 — First-run setup wizard

- Class: launchability
- Status: validated
- Description: On first run, if optional tool API keys (Brave, Context7, Jina) are missing, a wizard prompts for them with masked input. Keys are stored in `~/.gsd/agent/auth.json` and hydrated into process.env on every launch. Wizard does not run on subsequent starts if keys are already configured. Anthropic auth is handled by pi's OAuth/API key flow — not the wizard.
- Why it matters: Without API keys, nothing works. A wizard that detects and collects missing keys turns a broken first run into a successful one.
- Source: user
- Primary owning slice: M001/S03
- Supporting slices: none
- Validation: S03 — automated verify script (6/6 pass) + interactive UAT; wizard fires for missing optional keys, stores them, TUI launches, rerun skips wizard

### R007 — Isolated state in ~/.gsd/

- Class: quality-attribute
- Status: validated
- Description: All GSD state (auth, sessions, settings, logs) lives in `~/.gsd/`, completely separate from `~/.pi/`. Installing gsd must not modify or read a user's existing pi configuration.
- Why it matters: Users may have an existing pi installation. GSD must not corrupt or interfere with it.
- Source: inferred
- Primary owning slice: M001/S01
- Supporting slices: none
- Validation: S01 — ~/.gsd/agent/ and ~/.gsd/sessions/ created after launch; ~/.pi/agent/sessions/ count unchanged (28/28) before and after gsd run

### R008 — npm update workflow

- Class: continuity
- Status: validated
- Description: `npm update -g gsd-pi` installs a new version with updated bundled resources. The update is clean — no stale extension files from old versions.
- Why it matters: Software that can't update cleanly accumulates technical debt and breaks silently.
- Source: user
- Primary owning slice: M001/S04
- Supporting slices: none
- Validation: S04 — cpSync force:true in initResources ensures npm update -g replaces bundled resources; tarball smoke test confirms clean install path

### R009 — Observable failure state

- Class: failure-visibility
- Status: validated
- Description: If optional tool API keys are missing in a non-interactive run, the warning is actionable: it names the missing providers. Extension load failures are surfaced, not silently swallowed.
- Why it matters: Silent failures are debugging nightmares. A future agent or user must be able to localize what broke without guessing.
- Source: inferred
- Primary owning slice: M001/S03
- Supporting slices: M001/S02
- Validation: S03 — non-TTY warning names all three missing providers (Brave Search, Context7, Jina); cat ~/.gsd/agent/auth.json shows stored state; extension load failure surface from S02 confirmed intact

### R010 — Test flow execution

- Class: core-capability
- Status: active
- Description: The agent can write YAML test specifications during development and execute them against browser, mac, and api targets via `run_test_flow` and `run_test_suite` tools. Flows use intent-based verification blocks (verify/given/expect) that the agent interprets adaptively. Browser tests run in a fresh isolated Playwright session.
- Why it matters: Closes the gap between "agent builds a feature" and "agent proves it works" — durable, re-runnable test artifacts that survive context wipes.
- Source: user
- Primary owning slice: M003 (TBD)
- Supporting slices: none
- Validation: unmapped

### R011 — Flow-driven UAT

- Class: core-capability
- Status: active
- Description: GSD auto-mode recognizes `flow-driven` as a UAT type. At slice completion, the UAT pipeline automatically executes all flow files in the slice's `flows/` directory and writes structured pass/fail results to the UAT result file.
- Why it matters: Makes UAT fully autonomous for slices with test flows — no human intervention needed for UI/API verification.
- Source: user
- Primary owning slice: M003 (TBD)
- Supporting slices: none
- Validation: unmapped

## Deferred

### R020 — Plugin system

- Class: differentiator
- Status: deferred
- Description: Allow users to install additional pi packages on top of GSD via `gsd install npm:pkg`
- Why it matters: Makes GSD extensible beyond what ships in the box
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: Deferred — M001 ships bundled-only. Plugin support is explicitly post-MVP.

### R021 — Skills bundle

- Class: core-capability
- Status: deferred
- Description: Ship the skills from `~/.pi/agent/skills/` as bundled GSD skills
- Why it matters: Skills provide specialized workflows
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: unmapped
- Notes: User explicitly excluded skills from M001. Can add in M002.

## Out of Scope

### R030 — pi compatibility / interoperability

- Class: anti-feature
- Status: out-of-scope
- Description: GSD does not read from or write to `~/.pi/`. There is no migration from pi to gsd. No `pi install npm:gsd` target.
- Why it matters: Prevents scope confusion. GSD is a product, not a pi extension.
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: Explicitly out of scope by architecture decision.

### R031 — Web/desktop UI

- Class: constraint
- Status: out-of-scope
- Description: GSD 2.0 is terminal-only. No web UI, no Electron wrapper, no RPC mode.
- Why it matters: Keeps scope focused on the CLI product.
- Source: inferred
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: `pi-web-ui` and RPC mode explicitly not used.

## Traceability

| ID   | Class              | Status       | Primary owner | Supporting | Proof    |
| ---- | ------------------ | ------------ | ------------- | ---------- | -------- |
| R001 | primary-user-loop  | validated    | M001/S01      | M001/S04   | S04 — npm install -g gsd-pi from registry; zero extension errors; binary confirmed |
| R002 | differentiator     | validated    | M001/S01      | none       | S01 — TUI shows "gsd", piConfig confirmed, ~/.gsd/ confirmed |
| R003 | core-capability    | validated    | M001/S02      | none       | S02 — gsd extension loads clean; interactive /gsd use deferred to S04 |
| R004 | core-capability    | validated    | M001/S02      | none       | S02 — all 10 supporting extensions load without errors; functional use deferred to S04 |
| R005 | core-capability    | validated    | M001/S02      | none       | S02 — agents present; AGENTS.md (15,070 bytes) written to ~/.gsd/agent/ on first launch |
| R006 | launchability      | validated    | M001/S03      | none       | S03 — optional-key wizard fires, stores, skips on rerun |
| R007 | quality-attribute  | validated    | M001/S01      | none       | S01 — ~/.gsd/ created; ~/.pi/ sessions unchanged (28/28) |
| R008 | continuity         | validated    | M001/S04      | none       | S04 — cpSync force:true; tarball smoke confirms clean install path |
| R009 | failure-visibility | validated    | M001/S03      | M001/S02   | S03 — non-TTY warning names missing providers; extension errors surface confirmed |
| R020 | differentiator     | deferred     | none          | none       | unmapped |
| R021 | core-capability    | deferred     | none          | none       | unmapped |
| R010 | core-capability    | active       | M003 (TBD)    | none       | unmapped |
| R011 | core-capability    | active       | M003 (TBD)    | none       | unmapped |
| R030 | anti-feature       | out-of-scope | none          | none       | n/a      |
| R031 | constraint         | out-of-scope | none          | none       | n/a      |

## Coverage Summary

- Active requirements: 11
- Mapped to slices: 9
- Validated: 9 (R001, R002, R003, R004, R005, R006, R007, R008, R009)
- Unmapped active requirements: 2 (R010, R011 — pending M003 planning)
