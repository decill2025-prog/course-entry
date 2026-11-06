import { describe, expect, it } from "vitest";
import { cleanChat, isGhostTranscript, isGreeting, speechText } from "@/lib/ai.functions";

describe("Nexus chat greeting", () => {
  it("treats hi as a greeting", () => expect(isGreeting("hi")).toBe(true));
  it("treats how far as a greeting", () => expect(isGreeting("How far?")).toBe(true));
  it("does not treat a study question as a greeting", () => expect(isGreeting("hi explain recursion")).toBe(false));
});
describe("speech-to-text silence filter", () => {
  it("drops a lone 'Thank you'", () => expect(isGhostTranscript("Thank you.")).toBe(true));
  it("keeps real speech", () => expect(isGhostTranscript("Thank you, now explain Ohm's law")).toBe(false));
});
describe("chat code blocks", () => {
  it("keeps fenced code intact for copying", () => {
    const t = cleanChat("Use this:\n```python\nprint('hi')\n```");
    expect(t).toContain("```python");
    expect(t).toContain("print('hi')");
  });
  it("strips markdown noise from prose", () => expect(cleanChat("a **bold** idea")).toBe("a bold idea"));
  it("never reads code aloud", () => expect(speechText("Look:\n```js\nlet x = 1;\n```")).not.toContain("let x"));
});

import { speakable } from "@/lib/ai.functions";
import { nextTopic } from "@/lib/feed-engine";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("final fixes", () => {
  i2("voice text has no slashes or e.g.", () => { e2(speakable("Input/output, e.g. a mouse")).toBe("Input or output, for example a mouse"); });
  i2("daily topic changes each day and is the same for coursemates", () => {
    const a = nextTopic("100 Level", "B.Sc Computer Science", "Computing", new Set(), new Date("2026-11-05"));
    const b = nextTopic("100 Level", "B.Sc Computer Science", "Computing", new Set(), new Date("2026-11-05"));
    const c = nextTopic("100 Level", "B.Sc Computer Science", "Computing", new Set(), new Date("2026-11-06"));
    e2(a).toEqual(b); e2(a).not.toEqual(c);
  });
});
