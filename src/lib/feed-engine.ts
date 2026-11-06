// Client-side AI feed engine: picks scheme-of-work topics per device, asks the server for one post at a time,
// and saves every post on the phone (localStorage) so the feed stays readable offline.
import type { Level } from "@/lib/nexus-data";
import type { Icon, Lesson } from "@/lib/lessons";
import { topicsFor } from "@/lib/scheme";

export type StoredPost = Lesson & { ai: true; hook: string; steps: string[]; example: string; at: number; courseTitle: string; say?: string | undefined };

export const DAILY_CAP = 20; // posts generated per device per day (5 Groq keys ≈ 5,000/day shared by everyone)
export const SESSION_BATCH = 3;

const key = (level: Level, course: string) => `nexus.posts.v2.${level}.${course}`;
const ICONS: Icon[] = ["cpu", "flask", "atom", "sigma", "book", "cog", "building", "dna"];

export function loadPosts(level: Level, course: string): StoredPost[] {
  try { return JSON.parse(localStorage.getItem(key(level, course)) || "[]") as StoredPost[]; } catch { return []; }
}
export function savePosts(level: Level, course: string, posts: StoredPost[]) {
  try { localStorage.setItem(key(level, course), JSON.stringify(posts.slice(0, 60))); } catch { /* storage full: keep in memory */ }
}


/** Budget check: returns how many more posts this device may generate today. */
export function remainingToday(now = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  try {
    const b = JSON.parse(localStorage.getItem("nexus.budget") || "{}") as { day?: string; n?: number };
    return b.day === day ? Math.max(0, DAILY_CAP - (b.n ?? 0)) : DAILY_CAP;
  } catch { return DAILY_CAP; }
}
export function spendOne(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const left = remainingToday(now);
  localStorage.setItem("nexus.budget", JSON.stringify({ day, n: DAILY_CAP - left + 1 }));
}

/** True when this device already generated a lesson today: the feed writes at most one fresh AI lesson per day. */
export function postedToday(now = new Date(), posts: { at: number }[]): boolean {
  const day = now.toDateString();
  return posts.some((p) => new Date(p.at).toDateString() === day);
}

/** Today's topic: moves forward one scheme-of-work topic per calendar day, same for every coursemate; skips topics already saved. */
export function nextTopic(level: Level, course: string, faculty: string, used: Set<string>, now = new Date()) {
  const all = topicsFor(level, course, faculty);
  if (!all.length) return null;
  const start = Math.floor(now.getTime() / 86400000) % all.length;
  for (let i = 0; i < all.length; i++) {
    const t = all[(start + i) % all.length]!;
    if (!used.has(`${t.code}:${t.topic}`)) return t;
  }
  return all[(start + used.size) % all.length]!; // all covered: revise
}

export function toStored(p: { title: string; hook: string; body: string; steps: string[]; example: string; trick: string; trap: string; points: string[]; say?: string | undefined }, t: { code: string; courseTitle: string; topic: string }, id?: string, at?: number): StoredPost {
  const h = [...t.code].reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    id: id ?? `ai-${Date.now().toString(36)}`, ai: true, say: p.say, code: t.code, tag: t.topic, courseTitle: t.courseTitle,
    title: p.title, hook: p.hook, body: p.body, steps: p.steps, example: p.example, trick: p.trick, trap: p.trap,
    points: (p.points.filter((x) => x.trim().length > 3 && x.length < 90 && !/^say\b/i.test(x.trim())).slice(0, 3).length ? p.points.filter((x) => x.trim().length > 3 && x.length < 90 && !/^say\b/i.test(x.trim())).slice(0, 3) : [t.topic]), hue: (h * 37) % 360, icon: ICONS[h % ICONS.length]!, at: at ?? Date.now(),
  };
}

/** Merge server lessons with saved ones: no duplicate ids or topics, newest first. */
export function mergePosts(a: StoredPost[], b: StoredPost[]): StoredPost[] {
  const seen = new Set<string>(); const out: StoredPost[] = [];
  for (const p of [...a, ...b].sort((x, y) => y.at - x.at)) {
    const k = `${p.code}:${p.tag}`;
    if (seen.has(p.id) || seen.has(k)) continue;
    seen.add(p.id); seen.add(k); out.push(p);
  }
  return out;
}
