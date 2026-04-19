import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

test("onboarding handler resolves wizard module from deployed runtime paths", () => {
  const source = readFileSync(
    join(import.meta.dirname, "..", "commands", "handlers", "onboarding.ts"),
    "utf-8",
  )

  assert.match(
    source,
    /process\.env\.GSD_PKG_ROOT/,
    "handler should probe GSD_PKG_ROOT for deployed dist\/onboarding.js",
  )

  assert.match(
    source,
    /process\.argv\[1\]/,
    "handler should fall back to argv-derived package root when env is missing",
  )

  assert.match(
    source,
    /candidates\.push\("\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/onboarding\.js"\)/,
    "handler must keep the relative source\/dist fallback",
  )

  assert.match(
    source,
    /for \(const specifier of candidates\)/,
    "handler should try candidates in order",
  )

  assert.match(
    source,
    /Failed to load onboarding wizard module/,
    "handler should throw a diagnostic error when no candidate resolves",
  )
})
