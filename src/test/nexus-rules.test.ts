import { describe, expect, it } from "vitest";
import { COURSES, LEVELS, FACULTIES, isExpired, courseName } from "@/lib/nexus-data";

describe("nexus rules", () => {
  it("has exactly 35 courses sorted A–Z", () => {
    expect(COURSES).toHaveLength(35);
    const names = COURSES.map((c) => courseName(c.name));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
  it("limits levels to 100 and 200", () => expect([...LEVELS]).toEqual(["100 Level", "200 Level"]));
  it("has four faculties", () => expect(FACULTIES).toHaveLength(4));
  it("expires cached content after 72 hours", () => {
    const t = 0;
    expect(isExpired(t, 71 * 3600e3)).toBe(false);
    expect(isExpired(t, 73 * 3600e3)).toBe(true);
  });
});

import { CLEARANCE } from "@/lib/nexus-data";
describe("fresher clearance", () => {
  it("has 13 steps", () => expect(CLEARANCE).toHaveLength(13));
});

import { lessonsFor, allLessons } from "@/lib/lessons";
describe("course-matched feed", () => {
  it("never shows biology to 200L computing students", () => {
    const codes = lessonsFor("200 Level", "Computing & Cyber Systems").map((l) => l.code);
    expect(codes.some((c) => c.startsWith("BIO") || c.startsWith("BCH"))).toBe(false);
  });
  it("shows only 200-level lessons to 200L", () => {
    const codes = lessonsFor("200 Level", "Natural & Applied Sciences").map((l) => l.code);
    expect(codes.every((c) => /\s2\d\d$/.test(c))).toBe(true);
  });
  it("every lesson has a memory trick and exam trap", () => {
    expect(allLessons().every((l) => l.trick && l.trap && l.points.length >= 3)).toBe(true);
  });
});
