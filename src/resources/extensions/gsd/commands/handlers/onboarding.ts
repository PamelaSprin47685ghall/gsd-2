// GSD — /gsd onboarding command handler (re-entry, --resume, --reset, --step)
//
// Provides the discoverable re-entry point for the onboarding wizard. The
// first-run wizard in src/onboarding.ts is hidden behind shouldRunOnboarding;
// this handler lets users re-launch it on demand.

import type { ExtensionCommandContext } from "@gsd/pi-coding-agent"
import { AuthStorage } from "@gsd/pi-coding-agent"
import { authFilePath } from "../../../../../app-paths.js"
import {
  ONBOARDING_STEPS,
  isValidStepId,
  nearestResumeStep,
  type OnboardingStepId,
} from "../../setup-catalog.js"
import {
  isOnboardingComplete,
  readOnboardingRecord,
  resetOnboarding,
} from "../../onboarding-state.js"

interface ParsedArgs {
  resume: boolean
  reset: boolean
  step: string | null
  stepValid: boolean | null
}

function parseArgs(raw: string): ParsedArgs {
  const tokens = raw.split(/\s+/).filter(Boolean)
  const out: ParsedArgs = { resume: false, reset: false, step: null, stepValid: null }
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === "--resume" || t === "resume") out.resume = true
    else if (t === "--reset" || t === "reset") out.reset = true
    else if (t === "--step" || t === "step") {
      const next = tokens[i + 1]
      if (next) {
        out.step = next
        out.stepValid = isValidStepId(next)
        i++
      }
    } else if (t.startsWith("--step=")) {
      const v = t.slice(7)
      out.step = v
      out.stepValid = isValidStepId(v)
    }
  }
  return out
}

async function getAuthStorage(): Promise<AuthStorage> {
  return AuthStorage.create(authFilePath)
}

async function runWholeWizard(ctx: ExtensionCommandContext, fromStep?: OnboardingStepId): Promise<void> {
  const authStorage = await getAuthStorage()
  // The first-run wizard ignores the resume hint today — it always walks the
  // full sequence with skip prompts. We still mark completion at the end and
  // record the resume hint for next time. This keeps the wizard linear and
  // simple; per-step jump support comes via --step.
  if (fromStep) {
    ctx.ui.notify(
      `Resuming from step: ${fromStep}. The wizard runs all remaining steps; press skip on any you've already configured.`,
      "info",
    )
  }
  const { runOnboarding } = await import("../../../../../onboarding.js")
  await runOnboarding(authStorage)
}

async function runSingleStep(ctx: ExtensionCommandContext, stepId: OnboardingStepId): Promise<void> {
  const authStorage = await getAuthStorage()
  const ob = await import("../../../../../onboarding.js")
  // Lazy-load clack + chalk via the same path the wizard uses
  const p = await import("@clack/prompts")
  const { default: chalk } = await import("chalk")
  const pc = {
    cyan: chalk.cyan, green: chalk.green, yellow: chalk.yellow,
    dim: chalk.dim, bold: chalk.bold, red: chalk.red, reset: chalk.reset,
  }

  switch (stepId) {
    case "llm":
      await ob.runLlmStep(p as any, pc as any, authStorage)
      return
    case "search":
      await ob.runWebSearchStep(p as any, pc as any, authStorage, false)
      return
    case "remote":
      await ob.runRemoteQuestionsStep(p as any, pc as any, authStorage)
      return
    case "tool-keys":
      await ob.runToolKeysStep(p as any, pc as any, authStorage)
      return
    case "model": {
      // Delegate to /gsd model picker
      const { handleCoreCommand } = await import("./core.js")
      await handleCoreCommand("model", ctx)
      return
    }
    case "prefs": {
      const { ensurePreferencesFile, handlePrefsWizard } = await import("../../commands-prefs-wizard.js")
      const { getGlobalGSDPreferencesPath } = await import("../../preferences.js")
      await ensurePreferencesFile(getGlobalGSDPreferencesPath(), ctx, "global")
      await handlePrefsWizard(ctx, "global")
      return
    }
    case "doctor": {
      // Best-effort: surface provider doctor results inline
      try {
        const { runProviderDoctor } = await import("../../doctor-providers.js") as any
        if (typeof runProviderDoctor === "function") {
          await runProviderDoctor(ctx)
          return
        }
      } catch { /* fall through */ }
      ctx.ui.notify("Run /gsd doctor to validate your setup.", "info")
      return
    }
    case "skills": {
      ctx.ui.notify("Skill install runs automatically during /gsd init. Use /gsd init or /skill manage.", "info")
      return
    }
    case "project": {
      const { handleCoreCommand } = await import("./core.js")
      await handleCoreCommand("init", ctx)
      return
    }
  }
}

function renderStatus(): string {
  const r = readOnboardingRecord()
  const lines: string[] = ["GSD Onboarding\n"]
  if (r.completedAt) {
    lines.push(`  Completed: ${r.completedAt}`)
  } else {
    lines.push(`  Status: not complete`)
  }
  if (r.lastResumePoint) lines.push(`  Last step: ${r.lastResumePoint}`)
  lines.push("")
  lines.push("  Steps:")
  for (const step of ONBOARDING_STEPS) {
    const mark = r.completedSteps.includes(step.id)
      ? "✓"
      : r.skippedSteps.includes(step.id)
        ? "↷"
        : "○"
    const reqTag = step.required ? " (required)" : ""
    lines.push(`    ${mark} ${step.id.padEnd(10)} — ${step.label}${reqTag}`)
  }
  return lines.join("\n")
}

export async function handleOnboarding(rawArgs: string, ctx: ExtensionCommandContext): Promise<void> {
  const args = parseArgs(rawArgs.trim())

  if (args.step !== null) {
    if (!args.stepValid) {
      const validIds = ONBOARDING_STEPS.map(s => s.id).join(", ")
      ctx.ui.notify(`Unknown step "${args.step}". Valid: ${validIds}`, "warning")
      return
    }
    await runSingleStep(ctx, args.step as OnboardingStepId)
    return
  }

  if (args.reset) {
    resetOnboarding()
    ctx.ui.notify(
      "Onboarding reset. Existing API keys/credentials are unchanged — manage them with /gsd keys.",
      "info",
    )
    await runWholeWizard(ctx)
    return
  }

  if (args.resume) {
    const r = readOnboardingRecord()
    const next = nearestResumeStep(r.lastResumePoint, r.completedSteps)
    await runWholeWizard(ctx, next)
    return
  }

  // No flags. If already complete, show status + offer choice.
  if (isOnboardingComplete()) {
    ctx.ui.notify(renderStatus(), "info")
    ctx.ui.notify(
      "Onboarding already complete. Use /gsd onboarding --reset to start over, or --step <name> to redo one section.",
      "info",
    )
    return
  }

  await runWholeWizard(ctx)
}

export { renderStatus as renderOnboardingStatus }
