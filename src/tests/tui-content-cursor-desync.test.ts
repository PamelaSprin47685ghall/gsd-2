/**
 * Regression test for #3764: TUI input clears and jumps up after PR #3744.
 *
 * PR #3744 used this.cursorRow (content end) as the movement baseline in
 * computeLineDiff, but it should be the post-render cursor position
 * (finalCursorRow). This test verifies that after IME cursor repositioning,
 * the next render computes correct movement deltas — no spurious jumps.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CURSOR_MARKER, TUI, type Component, type Terminal } from "@gsd/pi-tui";

class MockTTYTerminal implements Terminal {
  public writtenData: string[] = [];

  readonly isTTY = true;

  start(_onInput: (data: string) => void, _onResize: () => void): void {}
  stop(): void {}
  async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {}

  write(data: string): void {
    this.writtenData.push(data);
  }

  get columns(): number {
    return 80;
  }

  get rows(): number {
    return 24;
  }

  get kittyProtocolActive(): boolean {
    return false;
  }

  moveBy(_lines: number): void {}
  hideCursor(): void {}
  showCursor(): void {}
  clearLine(): void {}
  clearFromCursor(): void {}
  clearScreen(): void {}
  setTitle(_title: string): void {}
}

class DynamicLinesComponent implements Component {
  public lines: string[];

  constructor(lines: string[]) {
    this.lines = lines;
  }

  render(_width: number): string[] {
    return this.lines;
  }

  invalidate(): void {}
}

describe("TUI contentCursorRow tracking (#3764)", () => {
  it("does not produce spurious cursor jumps when content changes after IME positioning", () => {
    const terminal = new MockTTYTerminal();
    const tui = new TUI(terminal, false);
    const component = new DynamicLinesComponent([
      "header",
      `input: hello${CURSOR_MARKER}`,
      "status line",
    ]);

    tui.addChild(component);
    (tui as any).doRender();

    // After first render, hardwareCursorRow is at IME position (row 1),
    // but contentCursorRow should be at finalCursorRow (row 2, end of content).
    // Verify contentCursorRow is set correctly.
    assert.strictEqual(
      (tui as any).contentCursorRow,
      2,
      "contentCursorRow should be at content end (row 2) after first render",
    );
    assert.strictEqual(
      (tui as any).hardwareCursorRow,
      1,
      "hardwareCursorRow should be at IME cursor position (row 1) after positionHardwareCursor",
    );

    // Simulate typing — content changes on the same line
    terminal.writtenData = [];
    component.lines = [
      "header",
      `input: hello world${CURSOR_MARKER}`,
      "status line",
    ];

    (tui as any).doRender();

    // The differential render should update line 1 (the changed input line).
    // With the bug from PR #3744, computeLineDiff would use this.cursorRow (2)
    // instead of contentCursorRow (2), which happened to be the same — but the
    // critical test is that the buffer does NOT contain large cursor jumps.
    assert.ok(terminal.writtenData.length >= 1, "typing should trigger a render");

    const buffer = terminal.writtenData[0];
    // Should not contain \x1b[2A or \x1b[3A etc. (large upward jumps)
    const largeUpJump = buffer.match(/\x1b\[([3-9]|\d{2,})A/);
    assert.strictEqual(
      largeUpJump,
      null,
      `should not produce large upward cursor jumps, got: ${JSON.stringify(buffer)}`,
    );
  });

  it("contentCursorRow persists correctly across renders with shrinking content", () => {
    const terminal = new MockTTYTerminal();
    const tui = new TUI(terminal, false);
    const component = new DynamicLinesComponent([
      "line 1",
      `line 2${CURSOR_MARKER}`,
      "line 3",
      "line 4",
      "line 5",
    ]);

    tui.addChild(component);
    (tui as any).doRender();

    assert.strictEqual(
      (tui as any).contentCursorRow,
      4,
      "contentCursorRow should be 4 after rendering 5 lines",
    );

    // Shrink content
    terminal.writtenData = [];
    component.lines = [
      "line 1",
      `line 2${CURSOR_MARKER}`,
      "line 3",
    ];

    (tui as any).doRender();

    assert.strictEqual(
      (tui as any).contentCursorRow,
      2,
      "contentCursorRow should update to 2 after shrinking to 3 lines",
    );
  });
});
