import { describe, expect, it } from "vitest";
import { parseTimerCommand } from "./voiceTimer";

describe("voiceTimer", () => {
  it("starts and stops the timer", () => {
    expect(parseTimerCommand("Start")).toEqual({ kind: "start" });
    expect(parseTimerCommand("start the timer")).toEqual({ kind: "start" });
    expect(parseTimerCommand("stop")).toEqual({ kind: "stop" });
    expect(parseTimerCommand("Finished.")).toEqual({ kind: "stop" });
    expect(parseTimerCommand("finished at 2:30")).toEqual({ kind: "stop" });
    expect(parseTimerCommand("done")).toEqual({ kind: "stop" });
  });

  it("marks named steps", () => {
    expect(parseTimerCommand("first bloom")).toEqual({ kind: "mark", label: "first bloom" });
    expect(parseTimerCommand("Second pour!")).toEqual({ kind: "mark", label: "second pour" });
    expect(parseTimerCommand("mark the third pour")).toEqual({ kind: "mark", label: "third pour" });
    expect(parseTimerCommand("bloom")).toEqual({ kind: "mark", label: "bloom" });
    expect(parseTimerCommand("pouring now")).toEqual({ kind: "mark", label: "pour" });
    expect(parseTimerCommand("mark")).toEqual({ kind: "mark", label: "pour" });
    expect(parseTimerCommand("swirl")).toEqual({ kind: "mark", label: "swirl" });
  });

  it("leaves ticket changes and everything else alone", () => {
    expect(parseTimerCommand("two blooms")).toBeNull();
    expect(parseTimerCommand("no bloom")).toBeNull();
    expect(parseTimerCommand("ninety three degrees")).toBeNull();
    expect(parseTimerCommand("half a click finer")).toBeNull();
    expect(parseTimerCommand("")).toBeNull();
    expect(parseTimerCommand("first mark")).toBeNull();
  });
});
