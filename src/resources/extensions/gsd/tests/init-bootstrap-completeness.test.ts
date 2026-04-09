/**
 * GSD Init Wizard — Bootstrap completeness regression tests
 *
 * Regression test for #3880 — fresh install never creates gsd.db.
 *
 * The init wizard must create all artifacts needed for full-capability
 * mode: gsd.db (via ensureDbOpen), runtime/ directory, and STATE.md
 * (via deriveState + buildStateMarkdown). Without these, GSD enters
 * degraded markdown-only mode on every fresh install.
 *
 * These are structural tests that verify the init-wizard.ts source
 * contains the required calls in the correct order.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const wizardSrc = readFileSync(
  join(__dirname, "..", "init-wizard.ts"),
  "utf-8",
);

describe("init-wizard bootstrap completeness (#3880)", () => {
  // ── Gap 1: gsd.db must be created during init ─────────────────────────

  test("bootstrapGsdDirectory is followed by ensureDbOpen", () => {
    const bootstrapIdx = wizardSrc.indexOf("bootstrapGsdDirectory(basePath");
    const ensureDbIdx = wizardSrc.indexOf("ensureDbOpen(basePath)");
    assert.ok(bootstrapIdx > -1, "bootstrapGsdDirectory call should exist");
    assert.ok(ensureDbIdx > -1, "ensureDbOpen(basePath) call should exist");
    assert.ok(
      ensureDbIdx > bootstrapIdx,
      "ensureDbOpen must appear after bootstrapGsdDirectory so .gsd/ exists first",
    );
  });

  test("ensureDbOpen is imported from dynamic-tools", () => {
    assert.match(
      wizardSrc,
      /import.*dynamic-tools/,
      "init-wizard should import from dynamic-tools for ensureDbOpen",
    );
  });

  // ── Gap 2: runtime/ directory must be created during init ──────────────

  test("bootstrapGsdDirectory creates runtime/ directory", () => {
    // Find the bootstrapGsdDirectory function body
    const fnStart = wizardSrc.indexOf("function bootstrapGsdDirectory(");
    assert.ok(fnStart > -1, "bootstrapGsdDirectory function should exist");

    // Find the next function definition to bound the search
    const fnBody = wizardSrc.slice(fnStart, wizardSrc.indexOf("\nfunction ", fnStart + 1));

    assert.match(
      fnBody,
      /mkdirSync\(.*"runtime"/,
      'bootstrapGsdDirectory should create "runtime" directory',
    );
  });

  // ── Gap 3: STATE.md must be written during init ────────────────────────

  test("showProjectInit generates STATE.md after bootstrap", () => {
    const bootstrapIdx = wizardSrc.indexOf("bootstrapGsdDirectory(basePath");
    const deriveIdx = wizardSrc.indexOf("deriveState(basePath)");
    const stateIdx = wizardSrc.indexOf("buildStateMarkdown(state)");
    const saveIdx = wizardSrc.indexOf('resolveGsdRootFile(basePath, "STATE")');

    assert.ok(deriveIdx > -1, "deriveState call should exist in init-wizard");
    assert.ok(stateIdx > -1, "buildStateMarkdown call should exist in init-wizard");
    assert.ok(saveIdx > -1, "resolveGsdRootFile STATE call should exist in init-wizard");
    assert.ok(
      deriveIdx > bootstrapIdx,
      "deriveState must appear after bootstrapGsdDirectory",
    );
  });

  // ── Ordering: DB must be open before deriveState ───────────────────────

  test("ensureDbOpen appears before deriveState", () => {
    const ensureDbIdx = wizardSrc.indexOf("ensureDbOpen(basePath)");
    const deriveIdx = wizardSrc.indexOf("deriveState(basePath)");
    assert.ok(ensureDbIdx > -1, "ensureDbOpen should exist");
    assert.ok(deriveIdx > -1, "deriveState should exist");
    assert.ok(
      ensureDbIdx < deriveIdx,
      "ensureDbOpen must appear before deriveState so DB is ready for state derivation",
    );
  });
});
