/**
 * Tests for output formatting.
 * Runs with: node --experimental-strip-types --test
 */

import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { formatDiscoveryForTool, formatDiscoveryForCommand } from "../format.ts";
import type { DiscoveryResult } from "../types.ts";

const emptyResult: DiscoveryResult = {
  tools: [],
  allItems: [],
  summary: {
    mcpServers: 0,
    rules: 0,
    contextFiles: 0,
    settings: 0,
    totalItems: 0,
    toolsScanned: 8,
    toolsWithConfig: 0,
  },
  warnings: [],
  durationMs: 42,
};

const populatedResult: DiscoveryResult = {
  tools: [
    {
      tool: { id: "cursor", name: "Cursor", userDir: ".cursor", projectDir: ".cursor" },
      items: [
        {
          type: "mcp-server",
          name: "test-mcp",
          command: "node",
          args: ["server.js"],
          transport: "stdio",
          source: { tool: "cursor", toolName: "Cursor", path: "/project/.cursor/mcp.json", level: "project" },
        },
        {
          type: "rule",
          name: "style",
          content: "Use semicolons and strict TypeScript.",
          alwaysApply: true,
          source: { tool: "cursor", toolName: "Cursor", path: "/project/.cursor/rules/style.mdc", level: "project" },
        },
      ],
      warnings: [],
    },
    {
      tool: { id: "github-copilot", name: "GitHub Copilot", userDir: null, projectDir: ".github" },
      items: [
        {
          type: "context-file",
          name: "copilot-instructions.md",
          content: "Be helpful.",
          source: { tool: "github-copilot", toolName: "GitHub Copilot", path: "/project/.github/copilot-instructions.md", level: "project" },
        },
      ],
      warnings: [],
    },
  ],
  allItems: [],
  summary: {
    mcpServers: 1,
    rules: 1,
    contextFiles: 1,
    settings: 0,
    totalItems: 3,
    toolsScanned: 8,
    toolsWithConfig: 2,
  },
  warnings: [],
  durationMs: 15,
};
populatedResult.allItems = populatedResult.tools.flatMap((t) => t.items);

describe("formatDiscoveryForTool", () => {
  test("formats empty result", () => {
    const text = formatDiscoveryForTool(emptyResult);
    assert.ok(text.includes("0/8 tools with config"));
    assert.ok(text.includes("No configuration found"));
  });

  test("formats populated result with sections", () => {
    const text = formatDiscoveryForTool(populatedResult);
    assert.ok(text.includes("2/8 tools with config"));
    assert.ok(text.includes("1 MCP server(s)"));
    assert.ok(text.includes("Cursor"));
    assert.ok(text.includes("test-mcp"));
    assert.ok(text.includes("GitHub Copilot"));
    assert.ok(text.includes("copilot-instructions.md"));
  });
});

describe("formatDiscoveryForCommand", () => {
  test("formats empty result", () => {
    const lines = formatDiscoveryForCommand(emptyResult);
    const text = lines.join("\n");
    assert.ok(text.includes("0 of 8"));
    assert.ok(text.includes("No configuration found"));
  });

  test("formats populated result as summary", () => {
    const lines = formatDiscoveryForCommand(populatedResult);
    const text = lines.join("\n");
    assert.ok(text.includes("2 of 8"));
    assert.ok(text.includes("Cursor"));
    assert.ok(text.includes("MCP: test-mcp"));
  });
});
