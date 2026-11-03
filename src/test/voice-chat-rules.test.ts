import { describe, expect, it } from "vitest";
import { isGhostTranscript, isGreeting } from "@/lib/ai.functions";

describe("Nexus chat greeting", () => {
  it("treats hi as a greeting", () => expect(isGreeting("hi")).toBe(true));
  it("treats how far as a greeting", () => expect(isGreeting("How far?")).toBe(true));
  it("does not treat a study question as a greeting", () => expect(isGreeting("hi explain recursion")).toBe(false));
});
describe("speech-to-text silence filter", () => {
  it("drops a lone 'Thank you'", () => expect(isGhostTranscript("Thank you.")).toBe(true));
  it("keeps real speech", () => expect(isGhostTranscript("Thank you, now explain Ohm's law")).toBe(false));
});
