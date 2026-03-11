# M003: AI-Driven Test Flows — Context

**Gathered:** 2026-03-11
**Status:** Queued — pending auto-mode execution

## Project Description

A new GSD extension (`test-flows`) that introduces intent-based YAML test specifications the agent writes during development and executes autonomously at UAT time. Flows describe **what to verify** (not mechanical step-by-step scripts), and the agent interprets each verification block using its full adaptive intelligence — choosing selectors, handling flakiness, retrying intelligently, and diagnosing failures.

Supports three target surfaces: **browser** (web apps via Playwright), **mac** (native macOS apps via Accessibility APIs), and **api** (HTTP request/response verification).

This is GSD's testing arm — the thing that closes the loop between "agent builds a feature" and "agent proves it works."

## Why This Milestone

GSD's current UAT pipeline has a gap: `artifact-driven` UAT runs shell commands and file checks, while `live-runtime` and `human-experience` UAT punt to the human. There is no way for the agent to write durable, re-runnable UI/API tests during development that execute automatically at UAT time.

The agent already has the tools (`browser_*`, `mac_*`, `bash` for HTTP) — what's missing is a structured format for persisting test intent and a runner that orchestrates execution against fresh isolated sessions. This milestone fills that gap.

The insight from Maestro evaluation: don't compete with Maestro as a standalone deterministic test runner. Instead, leverage what GSD is uniquely good at — AI-driven adaptive execution of test specifications. The YAML files are intent specs, not scripts. The AI handles the "how."

## User-Visible Outcome

### When this milestone is complete, the user can:

- See the agent write `.yaml` test flow files during slice development that describe what to verify
- Have UAT run automatically at slice completion — the agent executes all flow files and writes a structured pass/fail report
- Read `S01-UAT-RESULT.md` with per-flow, per-verification pass/fail results, timing, screenshots on failure, and diagnostic context
- Manually trigger test flows via the agent calling `run_test_flow` or `run_test_suite` tools at any time
- Test web apps (browser target), macOS apps (mac target), and APIs (api target) from the same flow format

### Entry point / environment

- Entry point: LLM tool calls (`run_test_flow`, `run_test_suite`) + GSD auto-mode UAT pipeline
- Environment: local dev (macOS terminal running `gsd`)
- Live dependencies involved: Playwright (bundled), mac-tools Swift CLI (bundled), HTTP via Node fetch (built-in)

## Completion Class

- Contract complete means: flow YAML parser validates correctly, runner executes all three targets (browser/mac/api) and returns structured results, `flow-driven` UAT type is recognized by the auto-mode pipeline
- Integration complete means: agent writes flows during development, auto-mode UAT dispatches `run_test_suite`, results appear in `S01-UAT-RESULT.md`, failures include screenshots and diagnostics
- Operational complete means: the full loop works end-to-end in a real GSD auto-mode session — agent builds a web feature, writes test flows, completes the slice, UAT runs the flows, report is written

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- Agent can write a browser-target flow YAML during development, and `run_test_flow` executes it against a running local web app with correct pass/fail results
- Agent can write a mac-target flow YAML, and it executes against a real macOS app (e.g., TextEdit) with correct pass/fail results
- Agent can write an api-target flow YAML with HTTP request/response checks, and it executes correctly
- `flow-driven` UAT type triggers automatic test suite execution at slice completion in auto-mode, with results written to the UAT result file
- Test execution uses a fresh isolated browser session, not the agent's development browser
- Failures include actionable diagnostics: screenshots, console logs (browser), element state (mac), response bodies (api)

## Risks and Unknowns

- **Inter-extension isolation** — The test-flows extension must run its own Playwright browser instance, separate from browser-tools' instance. Two Playwright instances in the same process should work (Playwright supports it), but needs verification. If they conflict, the runner may need to use a subprocess.
- **Mac-tools CLI access** — The test-flows extension needs to call the mac-tools Swift CLI binary directly. The binary is compiled on first use by the mac-tools extension. test-flows must either wait for mac-tools to compile it first, or handle compilation itself. Need to determine the right approach.
- **Agent flow authoring quality** — The value depends on Claude writing good test specifications during development. If the generated flows are too vague or too brittle, the system fails in practice. This is a prompt engineering challenge, not a code challenge. The system prompt guidelines for the tool must be excellent.
- **Adaptive execution reliability** — Each `verify` block is interpreted by the LLM. Non-determinism means a flow might pass one run and fail the next. Need to design the execution model to minimize this (clear verify/expect structure, retries, good diagnostics on failure).
- **Execution model for verify blocks** — The runner tool receives a YAML flow and must execute each verify block. Since extensions can't call other extensions' tools, the runner must use Playwright/mac-tools/fetch directly (not via `browser_*` tools). This means reimplementing some of the smart waiting/settling logic from browser-tools. Alternatively, each verify block could be dispatched as an LLM sub-turn — but that's expensive and slow. The right balance needs to be found.

## Existing Codebase / Prior Art

- `src/resources/extensions/browser-tools/index.ts` — Full Playwright browser automation extension (~4990 lines). Reference for Playwright patterns, adaptive settling, assertion evaluation, screenshot capture. The test-flows runner will import Playwright directly rather than calling these tools.
- `src/resources/extensions/browser-tools/core.js` — Runtime-neutral helpers: action timeline, assertion evaluation (`evaluateAssertionChecks`), compact state diffing. May be importable by test-flows.
- `src/resources/extensions/mac-tools/index.ts` — macOS Accessibility API automation via Swift CLI. Reference for how to invoke the Swift CLI binary (`execFileSync` with JSON protocol).
- `src/resources/extensions/gsd/auto.ts` — GSD auto-mode engine. Contains `checkNeedsRunUat()`, `buildRunUatPrompt()`, UAT dispatch logic. Must be modified to support `flow-driven` UAT type.
- `src/resources/extensions/gsd/files.ts` — Contains `extractUatType()` which classifies UAT types from markdown content. Must be extended with `flow-driven`.
- `src/resources/extensions/gsd/prompts/run-uat.md` — UAT execution prompt template. Must be extended with `flow-driven` instructions.
- `src/resources/extensions/gsd/templates/uat.md` — UAT file template. Must include `flow-driven` as a valid UAT mode.
- Maestro (external, not embedded) — Inspiration for YAML flow format and "arm's length" testing philosophy. Not a dependency. Key takeaways: declarative YAML syntax, smart waiting, accessibility-layer interaction, cross-platform unified format.

> See `.gsd/DECISIONS.md` for all architectural and pattern decisions — it is an append-only register; read it during planning, append to it during execution.

## Relevant Requirements

- R003 (Bundled GSD extension) — This extends the GSD extension's UAT pipeline with a new type
- R004 (Bundled supporting extensions) — This adds a new bundled extension (`test-flows`)
- New requirement candidates:
  - R010 — Test flow execution: agent can write and execute YAML test specifications against browser, mac, and api targets
  - R011 — Flow-driven UAT: auto-mode recognizes `flow-driven` UAT type and executes test suites automatically at slice completion

## Scope

### In Scope

- New `test-flows` extension in `src/resources/extensions/test-flows/`
- YAML flow format: header (name, target, url/app/endpoint) + verification blocks (verify/given/expect)
- Flow parser with validation and clear error messages
- Browser target runner: own Playwright instance, fresh context per flow, smart waiting, screenshot capture
- Mac target runner: direct Swift CLI invocation, element resolution, screenshot capture
- API target runner: HTTP requests via Node fetch, status/header/body assertions
- Two LLM tools: `run_test_flow` (single flow) and `run_test_suite` (directory of flows)
- Structured result output: per-flow, per-verification pass/fail, timing, screenshots, diagnostics
- New `flow-driven` UAT type in GSD extension (`files.ts`, `auto.ts`, `run-uat.md`, `uat.md`)
- System prompt guidelines that teach the agent when and how to write good test flows
- Flow files stored alongside slices: `.gsd/milestones/M00X/slices/S0X/flows/*.yaml`

### Out of Scope / Non-Goals

- Maestro compatibility (not a goal — different format, different execution model)
- Visual regression testing / image diffing (future enhancement)
- Parallel flow execution / sharding (future enhancement)
- CI/CD integration or headless-only mode (future enhancement)
- Flow recording / interactive flow authoring UI (future enhancement — Maestro Studio equivalent)
- Mobile device/simulator testing (would require Maestro or Appium — out of scope)

## Technical Constraints

- Must be a pi extension following existing patterns (`export default function(pi: ExtensionAPI)`)
- Must use TypeBox for tool parameter schemas, StringEnum for enums
- Must truncate tool output to stay within context limits
- Browser runner must use a separate Playwright instance from browser-tools (test isolation)
- Mac runner must invoke the Swift CLI binary at the known path (`src/resources/extensions/mac-tools/swift-cli/.build/release/mac-agent`)
- No new npm dependencies beyond what's already bundled (Playwright, yaml parsing via existing means)
- Extension loads via `additionalExtensionPaths` — same mechanism as all other bundled extensions

## Integration Points

- `browser-tools` extension — Shares Playwright dependency but NOT browser state. test-flows runs its own Playwright instance.
- `mac-tools` extension — test-flows calls the same Swift CLI binary but independently. Must handle the case where the binary hasn't been compiled yet.
- `gsd` extension — UAT pipeline integration: `files.ts` (extractUatType), `auto.ts` (checkNeedsRunUat, buildRunUatPrompt), `prompts/run-uat.md`, `templates/uat.md`
- `src/loader.ts` / `src/cli.ts` — test-flows must be added to `GSD_BUNDLED_EXTENSION_PATHS` and `initResources()` file sync
- Playwright — Direct import for browser automation (already a dependency of the project)
- Node.js `fetch` — For API target HTTP requests (built into Node 18+)

## Open Questions

- **Verify block execution model** — Should each `verify` block be executed by deterministic code (parse expect clauses, run Playwright assertions) or by sending the block to the LLM as a sub-task? Deterministic is faster and cheaper but less adaptive. LLM sub-task is more flexible but slower and non-deterministic. Hybrid approach (deterministic for simple assertions, LLM for complex "verify this looks right" blocks) may be the sweet spot. Needs design decision in planning.
- **YAML parsing** — Use `js-yaml` (would need to add as dependency) or parse the simple format manually? The format is simple enough that a hand-rolled parser might suffice and avoids a new dep.
- **Mac binary compilation timing** — If test-flows needs the mac-tools binary and it hasn't been compiled yet, should test-flows trigger compilation or just fail with a clear message? Triggering compilation would duplicate logic from mac-tools extension.
- **Flow file discovery for UAT** — When `run_test_suite` is called for a slice's flows, should it discover files by convention (all `.yaml` in the `flows/` dir) or should the UAT file explicitly list which flows to run?
