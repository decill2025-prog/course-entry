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
