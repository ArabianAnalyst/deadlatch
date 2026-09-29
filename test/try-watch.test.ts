import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { WatchBody, watchAfterFive, type FlagsDoc, type WatchIO } from "@/components/try/Playground";

const PAUSED: FlagsDoc = { paused: true, monitor: { state: "never", cursorSeq: null }, flags: [] };
const HEALTHY: FlagsDoc = { monitor: { state: "ok", cursorSeq: 41 }, flags: [] };
const FLAG = { id: "f1", expectationId: "velocity", reason: "five spends inside a minute", ref: { seq: 42 }, payee: "api.stripe.com", amount: "$12.50", at: "2026-09-29T00:00:00.000Z" };

const render = (flags: FlagsDoc | null, watchNote: string | null = null) => renderToStaticMarkup(createElement(WatchBody, { flags, watchError: null, watchNote }));

describe("Watch panel", () => {
  it("while paused shows only the paused sentence the page can know", () => {
    const html = render(PAUSED);
    expect(html).toContain("Watch is paused. The dashboard database is not answering, so flags will show here when it is back.");
    expect(html).not.toContain("still running");
  });
  it("while paused hides the monitor status row, heartbeat and cursor", () => {
    const html = render(PAUSED);
    expect(html).not.toContain("app-status");
    expect(html).not.toContain("no heartbeat yet");
    expect(html).not.toContain("no cursor yet");
  });
  it("while paused hides the empty-state line", () => {
    expect(render(PAUSED)).not.toContain("No flags yet");
  });
  it("when healthy keeps the status row and the empty-state line", () => {
    const html = render(HEALTHY);
    expect(html).toContain("monitor alive");
    expect(html).toContain("cursor 41");
    expect(html).toContain("No flags yet. Five in a row changes that.");
    expect(html).not.toContain("Watch is paused");
  });
});

/** A fake IO that answers from a script of flag replies and records every note and every fetch. */
function fakeIO(replies: FlagsDoc[]) {
  const notes: Array<string | null> = [];
  let fetches = 0;
  let waits = 0;
  let clock = 0;
  const io: WatchIO = {
    fetchFlags: async () => replies[Math.min(fetches++, replies.length - 1)],
    wait: async (ms) => { waits++; clock += ms; },
    alive: () => true,
    now: () => clock,
    setFlags: () => {},
    setWatchError: () => {},
    setWatchNote: (n) => { notes.push(n); },
  };
  return { io, notes, fetches: () => fetches, waits: () => waits };
}

describe("Five in a row watch", () => {
  it("stops at once and clears the note when the first reply is paused", async () => {
    const f = fakeIO([PAUSED]);
    await watchAfterFive(f.io);
    expect(f.fetches()).toBe(1);
    expect(f.waits()).toBe(0);
    expect(f.notes).toEqual([null]);
  });
  it("stops polling and clears the Watching note when a later reply is paused", async () => {
    const f = fakeIO([HEALTHY, HEALTHY, PAUSED, HEALTHY]);
    await watchAfterFive(f.io);
    expect(f.fetches()).toBe(3);
    expect(f.notes[0]).toMatch(/^Watching for the flag/);
    expect(f.notes.at(-1)).toBeNull();
  });
  it("still reports a new flag when the dashboard is answering", async () => {
    const f = fakeIO([HEALTHY, { ...HEALTHY, flags: [FLAG] }]);
    await watchAfterFive(f.io);
    expect(f.fetches()).toBe(2);
    expect(f.notes.at(-1)).toBe("Flagged 5 seconds after the fifth spend.");
  });
  it("gives up after eighteen polls with no flag", async () => {
    const f = fakeIO([HEALTHY]);
    await watchAfterFive(f.io);
    expect(f.fetches()).toBe(19);
    expect(f.notes.at(-1)).toMatch(/^No flag inside ninety seconds/);
  });
});
