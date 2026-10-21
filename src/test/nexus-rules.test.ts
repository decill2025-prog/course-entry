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

import { schemeFor } from "@/lib/scheme";
import { COURSES as ALL_COURSES } from "@/lib/nexus-data";
import { DAILY_CAP, remainingToday, spendOne } from "@/lib/feed-engine";
describe("scheme of work", () => {
  it("every one of the 35 courses has 100L and 200L courses", () => {
    for (const c of ALL_COURSES) {
      expect(schemeFor("100 Level", c.name, c.faculty).length).toBeGreaterThan(0);
      expect(schemeFor("200 Level", c.name, c.faculty).length).toBeGreaterThan(2);
    }
  });
  it("200L Computer Science studies CSC 201", () =>
    expect(schemeFor("200 Level", "B.Sc. Computer Science", "Computing & Cyber Systems").map((c) => c.code)).toContain("CSC 201"));
  it("100L never gets 200L courses", () =>
    expect(schemeFor("100 Level", "B.Sc. Computer Science", "Computing & Cyber Systems").some((c) => /\s2\d\d$/.test(c.code))).toBe(false));
});
describe("daily AI budget", () => {
  it("caps a device at 15 posts a day", () => {
    localStorage.clear();
    const d = new Date("2026-10-19T10:00:00Z");
    expect(DAILY_CAP).toBe(15);
    for (let i = 0; i < 15; i++) spendOne(d);
    expect(remainingToday(d)).toBe(0);
    expect(remainingToday(new Date("2026-10-20T10:00:00Z"))).toBe(15);
  });
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
