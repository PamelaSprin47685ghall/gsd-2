import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source-level regression test for Issue #4424: the Claude Code CLI
 * binary check must use the `.cmd` shim on Windows. Node's
 * `execFileSync('claude', ...)` does not resolve `.cmd`/`.bat` endings
 * automatically on win32, so npm-global installs fail to be detected and
 * the "Use Claude Code CLI" onboarding option silently disappears.
 *
 * Both the lightweight onboarding check (`src/claude-cli-check.ts`) and
 * the cached readiness check
 * (`src/resources/extensions/claude-code-cli/readiness.ts`) must carry
 * the `process.platform === 'win32'` ? 'claude.cmd' : 'claude'` guard —
 * analogous to the existing `NPM_COMMAND` pattern in
 * `src/resources/extensions/gsd/pre-execution-checks.ts`.
 */

test("claude-cli-check.ts selects claude.cmd on win32", () => {
	const source = readFileSync(
		join(import.meta.dirname, "..", "claude-cli-check.ts"),
		"utf-8",
	);

	assert.match(
		source,
		/win32/,
		"claude-cli-check.ts must branch on process.platform === 'win32'",
	);
	assert.match(
		source,
		/claude\.cmd/,
		"claude-cli-check.ts must reference 'claude.cmd' for Windows shim detection",
	);
});

test("readiness.ts selects claude.cmd on win32", () => {
	const source = readFileSync(
		join(
			import.meta.dirname,
			"..",
			"resources",
			"extensions",
			"claude-code-cli",
			"readiness.ts",
		),
		"utf-8",
	);

	assert.match(
		source,
		/win32/,
		"readiness.ts must branch on process.platform === 'win32'",
	);
	assert.match(
		source,
		/claude\.cmd/,
		"readiness.ts must reference 'claude.cmd' for Windows shim detection",
	);
});
