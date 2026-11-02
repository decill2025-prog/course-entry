import { describe, expect, it } from "vitest";
import { topicsFor } from "@/lib/scheme";
import { mergePosts, type StoredPost } from "@/lib/feed-engine";

describe("feed rules", () => {
  it("Forestry 100L never gets computing hardware/software topics", () => {
    const codes = topicsFor("100 Level", "B.Sc. Forestry and environmental Management", "Environmental Sciences").map((t) => t.code);
    expect(codes).not.toContain("COS 101");
    expect(codes).toContain("FWM 101");
  });
  it("merged feed never shows the same topic twice", () => {
    const p = (id: string, tag: string, at: number) => ({ id, code: "MTH 101", tag, at } as unknown as StoredPost);
    const out = mergePosts([p("a", "sets", 2)], [p("b", "sets", 1), p("c", "limits", 0)]);
    expect(out.map((x) => x.id)).toEqual(["a", "c"]);
  });
});
