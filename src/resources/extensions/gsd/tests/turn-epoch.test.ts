// Project: gsd-pi — Tests for the auto/turn-epoch stale-write guard.

import test from "node:test";
import assert from "node:assert/strict";

import {
  _resetTurnEpoch,
  bumpTurnGeneration,
  describeTurnEpoch,
  getCurrentTurnGeneration,
  isStaleWrite,
  runWithTurnGeneration,
} from "../auto/turn-epoch.ts";

test("turn-epoch: generation starts at 0 and bumps monotonically", () => {
  _resetTurnEpoch();
  assert.equal(getCurrentTurnGeneration(), 0);
  assert.equal(bumpTurnGeneration("test-a"), 1);
  assert.equal(bumpTurnGeneration("test-b"), 2);
  assert.equal(getCurrentTurnGeneration(), 2);
});

test("turn-epoch: isStaleWrite returns false when no turn context captured", () => {
  _resetTurnEpoch();
  bumpTurnGeneration("no-context");
  // Called outside runWithTurnGeneration — safe default is false.
  assert.equal(isStaleWrite("out-of-band"), false);
});

test("turn-epoch: isStaleWrite returns false inside a fresh turn", () => {
  _resetTurnEpoch();
  const captured = getCurrentTurnGeneration();
  runWithTurnGeneration(captured, () => {
    assert.equal(isStaleWrite("fresh"), false);
  });
});

test("turn-epoch: isStaleWrite returns true after the epoch bumps mid-turn", () => {
  _resetTurnEpoch();
  const captured = getCurrentTurnGeneration();
  runWithTurnGeneration(captured, () => {
    bumpTurnGeneration("recovery-fires");
    assert.equal(isStaleWrite("stale"), true);
  });
});

test("turn-epoch: nested turns each see their own captured generation", () => {
  _resetTurnEpoch();
  const outerGen = getCurrentTurnGeneration();
  runWithTurnGeneration(outerGen, () => {
    assert.equal(isStaleWrite("outer-fresh"), false);
    bumpTurnGeneration("bump-between");
    const innerGen = getCurrentTurnGeneration();
    runWithTurnGeneration(innerGen, () => {
      // Inner context saw the bumped generation at capture time — fresh.
      assert.equal(isStaleWrite("inner-fresh"), false);
    });
    // Back to outer context — still stale because outerGen < current.
    assert.equal(isStaleWrite("outer-after-bump"), true);
  });
});

test("turn-epoch: describeTurnEpoch surfaces captured vs current", () => {
  _resetTurnEpoch();
  bumpTurnGeneration("seed");
  const captured = getCurrentTurnGeneration();
  runWithTurnGeneration(captured, () => {
    let snapshot = describeTurnEpoch();
    assert.equal(snapshot.captured, captured);
    assert.equal(snapshot.current, captured);
    assert.equal(snapshot.stale, false);

    bumpTurnGeneration("supersede");
    snapshot = describeTurnEpoch();
    assert.equal(snapshot.captured, captured);
    assert.equal(snapshot.current, captured + 1);
    assert.equal(snapshot.stale, true);
  });

  // Outside the turn — captured is null, stale is false.
  const outside = describeTurnEpoch();
  assert.equal(outside.captured, null);
  assert.equal(outside.stale, false);
});

test("turn-epoch: AsyncLocalStorage propagates across awaits", async () => {
  _resetTurnEpoch();
  const captured = getCurrentTurnGeneration();
  await runWithTurnGeneration(captured, async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 1));
    bumpTurnGeneration("async-bump");
    await Promise.resolve();
    assert.equal(isStaleWrite("post-await"), true);
  });
});
