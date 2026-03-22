/**
 * GSD Skill Catalog — Curated skill packs mapped to tech stacks.
 *
 * Each pack maps a detected (or user-chosen) tech stack to a skills.sh
 * repo + specific skill names.  The init wizard uses this catalog to
 * install relevant skills during project onboarding.
 *
 * Installation is delegated entirely to the skills.sh CLI:
 *   npx skills add <repo> --skill <name> --skill <name> -y
 *
 * Skills are installed into ~/.agents/skills/ (the industry-standard
 * ecosystem directory shared across all agents).
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ExtensionCommandContext } from "@gsd/pi-coding-agent";
import { showNextAction } from "../shared/tui.js";
import type { ProjectSignals, XcodePlatform } from "./detection.js";

// ─── Catalog Types ────────────────────────────────────────────────────────────

export interface SkillPack {
  /** Human-readable name shown in the wizard */
  label: string;
  /** Short description */
  description: string;
  /** skills.sh repo identifier (owner/repo) */
  repo: string;
  /** Specific skill names to install from the repo */
  skills: string[];
  /** Which detected primaryLanguage values trigger this pack */
  matchLanguages?: string[];
  /** Which detected project files trigger this pack */
  matchFiles?: string[];
  /** Trigger when Xcode project targets one of these platforms */
  matchXcodePlatforms?: XcodePlatform[];
}

// ─── Curated Catalog ──────────────────────────────────────────────────────────

export const SKILL_CATALOG: SkillPack[] = [
  // ── Swift (language-level — any Swift project) ────────────────────────────
  {
    label: "SwiftUI",
    description: "SwiftUI layout, navigation, animations, gestures, Liquid Glass",
    repo: "dpearson2699/swift-ios-skills",
    skills: [
      "swiftui-animation",
      "swiftui-gestures",
      "swiftui-layout-components",
      "swiftui-liquid-glass",
      "swiftui-navigation",
      "swiftui-patterns",
      "swiftui-performance",
      "swiftui-uikit-interop",
    ],
    matchLanguages: ["swift"],
    matchFiles: ["Package.swift"],
  },
  {
    label: "Swift Core",
    description: "Swift language, concurrency, Codable, Charts, Testing, SwiftData",
    repo: "dpearson2699/swift-ios-skills",
    skills: [
      "swift-codable",
      "swift-charts",
      "swift-concurrency",
      "swift-language",
      "swift-testing",
      "swiftdata",
    ],
    matchLanguages: ["swift"],
    matchFiles: ["Package.swift"],
  },
  // ── iOS (Xcode project targeting iphoneos required) ───────────────────────
  {
    label: "iOS App Frameworks",
    description: "App Intents, Widgets, StoreKit, MapKit, Live Activities, push notifications",
    repo: "dpearson2699/swift-ios-skills",
    skills: [
      "alarmkit",
      "app-clips",
      "app-intents",
      "live-activities",
      "mapkit-location",
      "photos-camera-media",
      "push-notifications",
      "storekit",
      "tipkit",
      "widgetkit",
    ],
    matchXcodePlatforms: ["iphoneos"],
  },
  {
    label: "iOS Data Frameworks",
    description: "CloudKit, HealthKit, MusicKit, WeatherKit, Contacts, Calendar",
    repo: "dpearson2699/swift-ios-skills",
    skills: [
      "cloudkit-sync",
      "contacts-framework",
      "eventkit-calendar",
      "healthkit",
      "musickit-audio",
      "passkit-wallet",
      "weatherkit",
    ],
    matchXcodePlatforms: ["iphoneos"],
  },
  {
    label: "iOS AI & ML",
    description: "Core ML, Vision, on-device AI, speech recognition, NLP",
    repo: "dpearson2699/swift-ios-skills",
    skills: [
      "apple-on-device-ai",
      "coreml",
      "natural-language",
      "speech-recognition",
      "vision-framework",
    ],
    matchXcodePlatforms: ["iphoneos"],
  },
  {
    label: "iOS Engineering",
    description: "Networking, security, accessibility, localization, Instruments, App Store review",
    repo: "dpearson2699/swift-ios-skills",
    skills: [
      "app-store-review",
      "authentication",
      "background-processing",
      "debugging-instruments",
      "device-integrity",
      "ios-accessibility",
      "ios-localization",
      "ios-networking",
      "ios-security",
      "metrickit-diagnostics",
    ],
    matchXcodePlatforms: ["iphoneos"],
  },
  {
    label: "iOS Hardware",
    description: "Bluetooth, CoreMotion, NFC, PencilKit, RealityKit AR",
    repo: "dpearson2699/swift-ios-skills",
    skills: [
      "core-bluetooth",
      "core-motion",
      "core-nfc",
      "pencilkit-drawing",
      "realitykit-ar",
    ],
    matchXcodePlatforms: ["iphoneos"],
  },
  {
    label: "iOS Platform",
    description: "CallKit, EnergyKit, HomeKit, SharePlay, PermissionKit",
    repo: "dpearson2699/swift-ios-skills",
    skills: [
      "callkit-voip",
      "energykit",
      "homekit-matter",
      "permissionkit",
      "shareplay-activities",
    ],
    matchXcodePlatforms: ["iphoneos"],
  },
  // ── React / Next.js ───────────────────────────────────────────────────────
  {
    label: "React & Web Frontend",
    description: "React best practices, web design, accessibility, core web vitals",
    repo: "vercel-labs/agent-skills",
    skills: [
      "vercel-react-best-practices",
      "web-design-guidelines",
      "vercel-composition-patterns",
    ],
    matchLanguages: ["javascript/typescript"],
  },
  // ── React Native ──────────────────────────────────────────────────────────
  {
    label: "React Native",
    description: "React Native patterns and cross-platform mobile development",
    repo: "vercel-labs/agent-skills",
    skills: ["vercel-react-native-skills"],
    matchLanguages: ["javascript/typescript"],
  },
  // ── General Frontend ──────────────────────────────────────────────────────
  {
    label: "Frontend Design & UX",
    description: "Frontend design, accessibility, and browser automation",
    repo: "anthropics/skills",
    skills: ["frontend-design"],
    matchLanguages: ["javascript/typescript"],
  },
  // ── Rust ──────────────────────────────────────────────────────────────────
  {
    label: "Rust",
    description: "Rust language patterns and best practices",
    repo: "anthropics/skills",
    skills: ["rust-best-practices"],
    matchLanguages: ["rust"],
    matchFiles: ["Cargo.toml"],
  },
  // ── Python ────────────────────────────────────────────────────────────────
  {
    label: "Python",
    description: "Python patterns and best practices",
    repo: "anthropics/skills",
    skills: ["python-best-practices"],
    matchLanguages: ["python"],
    matchFiles: ["pyproject.toml", "setup.py"],
  },
  // ── Go ────────────────────────────────────────────────────────────────────
  {
    label: "Go",
    description: "Go language patterns and best practices",
    repo: "anthropics/skills",
    skills: ["go-best-practices"],
    matchLanguages: ["go"],
    matchFiles: ["go.mod"],
  },
  // ── General Tooling ───────────────────────────────────────────────────────
  {
    label: "Document Handling",
    description: "PDF, DOCX, XLSX, PPTX creation and manipulation",
    repo: "anthropics/skills",
    skills: ["pdf", "docx", "xlsx", "pptx"],
  },
];

// ─── Greenfield Tech Stack Choices ────────────────────────────────────────────

/**
 * Choices shown to users when no tech stack can be auto-detected
 * (greenfield repos or empty directories).
 */
export const GREENFIELD_STACKS: Array<{
  id: string;
  label: string;
  description: string;
  packs: string[];
}> = [
  {
    id: "ios",
    label: "iOS App",
    description: "Full iOS development — SwiftUI, Swift, and all iOS frameworks",
    packs: [
      "SwiftUI",
      "Swift Core",
      "iOS App Frameworks",
      "iOS Data Frameworks",
      "iOS AI & ML",
      "iOS Engineering",
      "iOS Hardware",
      "iOS Platform",
    ],
  },
  {
    id: "swift",
    label: "Swift (non-iOS)",
    description: "Swift packages, server-side Swift, CLI tools, SwiftUI without iOS",
    packs: ["SwiftUI", "Swift Core"],
  },
  {
    id: "react-web",
    label: "React Web",
    description: "React, Next.js, web frontend",
    packs: ["React & Web Frontend", "Frontend Design & UX"],
  },
  {
    id: "react-native",
    label: "React Native",
    description: "Cross-platform mobile with React Native",
    packs: ["React Native", "React & Web Frontend"],
  },
  {
    id: "fullstack-js",
    label: "Full-Stack JavaScript/TypeScript",
    description: "Node.js backend + React frontend",
    packs: ["React & Web Frontend", "Frontend Design & UX"],
  },
  {
    id: "rust",
    label: "Rust",
    description: "Systems programming with Rust",
    packs: ["Rust"],
  },
  {
    id: "python",
    label: "Python",
    description: "Python applications, scripts, or ML",
    packs: ["Python"],
  },
  {
    id: "go",
    label: "Go",
    description: "Go services and CLIs",
    packs: ["Go"],
  },
  {
    id: "other",
    label: "Other / Skip",
    description: "Install skills later with npx skills add",
    packs: [],
  },
];

// ─── Detection → Pack Matching ────────────────────────────────────────────────

/**
 * Match project signals to relevant skill packs.
 * Returns packs ordered by relevance (language match first, then file match).
 */
export function matchPacksForProject(signals: ProjectSignals): SkillPack[] {
  const matched = new Set<SkillPack>();

  for (const pack of SKILL_CATALOG) {
    // Language match
    if (pack.matchLanguages && signals.primaryLanguage) {
      if (pack.matchLanguages.includes(signals.primaryLanguage)) {
        matched.add(pack);
        continue;
      }
    }

    // File match
    if (pack.matchFiles) {
      for (const file of pack.matchFiles) {
        if (signals.detectedFiles.includes(file)) {
          matched.add(pack);
          break;
        }
      }
    }

    // Xcode platform match (e.g. iOS packs only when SDKROOT = iphoneos)
    if (pack.matchXcodePlatforms && signals.xcodePlatforms.length > 0) {
      const hasMatch = pack.matchXcodePlatforms.some((p) => signals.xcodePlatforms.includes(p));
      if (hasMatch) matched.add(pack);
    }
  }

  return [...matched];
}

// ─── Installation ─────────────────────────────────────────────────────────────

/**
 * Install a skill pack via the skills.sh CLI.
 * Runs: npx skills add <repo> --skill <name> ... -y
 *
 * Returns true if installation succeeded.
 */
export function installSkillPack(pack: SkillPack): Promise<boolean> {
  return new Promise((resolve) => {
    const args = ["--yes", "skills", "add", pack.repo];

    for (const skill of pack.skills) {
      args.push("--skill", skill);
    }
    args.push("-y");

    execFile("npx", args, { timeout: 120_000 }, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Install multiple packs, batching by repo to minimize npx invocations.
 * Returns the labels of successfully installed packs.
 */
export async function installPacksBatched(
  packs: SkillPack[],
  onProgress?: (label: string) => void,
): Promise<string[]> {
  // Group packs by repo
  const byRepo = new Map<string, { skills: string[]; labels: string[] }>();
  for (const pack of packs) {
    const entry = byRepo.get(pack.repo) ?? { skills: [], labels: [] };
    entry.skills.push(...pack.skills);
    entry.labels.push(pack.label);
    byRepo.set(pack.repo, entry);
  }

  const installed: string[] = [];
  for (const [repo, { skills, labels }] of byRepo) {
    onProgress?.(labels.join(", "));
    const ok = await new Promise<boolean>((resolve) => {
      const args = ["--yes", "skills", "add", repo];
      for (const skill of skills) {
        args.push("--skill", skill);
      }
      args.push("-y");
      execFile("npx", args, { timeout: 120_000 }, (error) => {
        resolve(!error);
      });
    });
    if (ok) installed.push(...labels);
  }
  return installed;
}

/**
 * Check if any skills from a pack are already installed.
 */
export function isPackInstalled(pack: SkillPack): boolean {
  const skillsDir = join(homedir(), ".agents", "skills");
  if (!existsSync(skillsDir)) return false;

  return pack.skills.every((name) =>
    existsSync(join(skillsDir, name, "SKILL.md")),
  );
}

// ─── Init Wizard Integration ──────────────────────────────────────────────────

/**
 * Run skill installation step during project init.
 *
 * Brownfield (signals.detectedFiles.length > 0):
 *   Auto-detects tech stack → shows matched packs → installs accepted ones.
 *
 * Greenfield (no files detected):
 *   Asks user what tech stack they're using → maps to packs → installs.
 *
 * Returns the list of installed pack labels.
 */
export async function runSkillInstallStep(
  ctx: ExtensionCommandContext,
  signals: ProjectSignals,
): Promise<string[]> {
  const installed: string[] = [];
  const isBrownfield = signals.detectedFiles.length > 0;

  if (isBrownfield) {
    // ── Brownfield: auto-detect and confirm ─────────────────────────────────
    const matched = matchPacksForProject(signals);
    if (matched.length === 0) return installed;

    // Filter out already-installed packs
    const toInstall = matched.filter((p) => !isPackInstalled(p));
    if (toInstall.length === 0) return installed;

    // Group for display: Swift packs vs iOS packs vs other
    const swiftPacks = toInstall.filter((p) => p.matchLanguages?.includes("swift"));
    const iosPacks = toInstall.filter((p) => p.matchXcodePlatforms?.includes("iphoneos"));
    const otherPacks = toInstall.filter((p) => !swiftPacks.includes(p) && !iosPacks.includes(p));

    const summaryLines: string[] = [];
    const hasIOS = signals.xcodePlatforms.includes("iphoneos");
    if (hasIOS) {
      summaryLines.push(`Detected: iOS project (${signals.primaryLanguage ?? "swift"})`);
    } else if (signals.xcodePlatforms.length > 0) {
      summaryLines.push(`Detected: ${signals.xcodePlatforms.join(", ")} Xcode project (${signals.primaryLanguage ?? "swift"})`);
    } else {
      summaryLines.push(`Detected: ${signals.primaryLanguage ?? "unknown"} project`);
    }
    summaryLines.push("");
    summaryLines.push("Recommended skill packs:");
    if (swiftPacks.length > 0) {
      summaryLines.push(`  Swift: ${swiftPacks.map((p) => p.label).join(", ")}`);
    }
    if (iosPacks.length > 0) {
      summaryLines.push(`  iOS: ${iosPacks.map((p) => p.label).join(", ")}`);
    }
    for (const p of otherPacks) {
      summaryLines.push(`  • ${p.label}: ${p.description}`);
    }

    const totalSkills = toInstall.reduce((n, p) => n + p.skills.length, 0);
    const choice = await showNextAction(ctx, {
      title: "GSD — Install Skills",
      summary: summaryLines,
      actions: [
        {
          id: "install",
          label: "Install recommended skills",
          description: `Install ${totalSkills} skills from ${toInstall.length} pack${toInstall.length > 1 ? "s" : ""} via skills.sh`,
          recommended: true,
        },
        {
          id: "skip",
          label: "Skip",
          description: "Install skills later with npx skills add",
        },
      ],
      notYetMessage: "Run /gsd init when ready.",
    });

    if (choice === "install") {
      const labels = await installPacksBatched(toInstall, (label) => {
        ctx.ui.notify(`Installing ${label} skills...`, "info");
      });
      installed.push(...labels);
      const failed = toInstall.filter((p) => !installed.includes(p.label));
      for (const pack of failed) {
        ctx.ui.notify(`Failed to install ${pack.label} — try manually: npx skills add ${pack.repo}`, "info");
      }
    }
  } else {
    // ── Greenfield: ask user what they're building ──────────────────────────
    const stackChoice = await showNextAction(ctx, {
      title: "GSD — Project Skills",
      summary: [
        "What are you building? GSD will install relevant agent skills.",
        "Skills are installed globally via skills.sh and shared across agents.",
      ],
      actions: GREENFIELD_STACKS.map((s) => ({
        id: s.id,
        label: s.label,
        description: s.description,
      })),
      notYetMessage: "Run /gsd init when ready.",
    });

    if (stackChoice === "not_yet" || stackChoice === "other") return installed;

    const stack = GREENFIELD_STACKS.find((s) => s.id === stackChoice);
    if (!stack) return installed;

    const packsToInstall = SKILL_CATALOG.filter((p) =>
      stack.packs.includes(p.label),
    ).filter((p) => !isPackInstalled(p));

    const labels = await installPacksBatched(packsToInstall, (label) => {
      ctx.ui.notify(`Installing ${label} skills...`, "info");
    });
    installed.push(...labels);
    const failed = packsToInstall.filter((p) => !installed.includes(p.label));
    for (const pack of failed) {
      ctx.ui.notify(`Failed to install ${pack.label} — try manually: npx skills add ${pack.repo}`, "info");
    }
  }

  if (installed.length > 0) {
    ctx.ui.notify(`Installed: ${installed.join(", ")}`, "info");
  }

  return installed;
}
