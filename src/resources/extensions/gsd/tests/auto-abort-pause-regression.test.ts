import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_END_RECOVERY_TS = join(__dirname, "..", "bootstrap", "agent-end-recovery.ts");
const AUTO_PHASES_TS = join(__dirname, "..", "auto", "phases.ts");
const AUTO_TS = join(__dirname, "..", "auto.ts");

test("aborted agent_end with errorMessage propagates structured pause context", () => {
  // allow-source-grep: regression guard for aborted-turn error-context propagation wiring.
  const source = readFileSync(AGENT_END_RECOVERY_TS, "utf-8");

  assert.ok(source.includes("category: \"aborted\""));
  assert.ok(source.includes("message: hasErrorMessage ? String(lastMsg.errorMessage) : \"Operation aborted\""));
});

test("cancelled non-session failures are not labeled as session-creation failures", () => {
  // allow-source-grep: regression guard for cancellation-message branch wording.
  const source = readFileSync(AUTO_PHASES_TS, "utf-8");

  assert.ok(source.includes("const isSessionCreationFailure = errorCategory === \"session-failed\""));
  assert.ok(source.includes("Unit ${unitType} ${unitId} aborted after dispatch"));
});

test("pause metadata persists pauseReason for resumable diagnostics", () => {
  // allow-source-grep: regression guard for persisted pause reason field.
  const source = readFileSync(AUTO_TS, "utf-8");

  assert.ok(source.includes("pauseReason: _errorContext?.message"));
});
