import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, GraduationCap, Layers, Loader2, Search } from "lucide-react";
import { COURSES, LEVELS, courseName, type Level } from "@/lib/nexus-data";

type Props = { onEnter: (p: { level: Level; course: string; faculty: string }) => void };

function useOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, cb]);
}

export function Gate({ onEnter }: Props) {
  const [level, setLevel] = useState<Level | "">("");
  const [course, setCourse] = useState("");
  const [open, setOpen] = useState<"level" | "course" | null>(null);
  const [q, setQ] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useOutside(box, () => setOpen(null));

  const list = useMemo(
    () => COURSES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
    [q],
  );
  const ready = level && course && agree && !loading;

  const enter = () => {
    if (!ready) return;
    setLoading(true);
    const faculty = COURSES.find((c) => c.name === course)?.faculty ?? "";
    setTimeout(() => onEnter({ level: level as Level, course, faculty }), 3200);
  };

  const field = "flex w-full items-center gap-3 rounded-xl border border-border bg-input/40 px-3.5 py-3 text-left text-sm transition hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4 py-8">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl animate-float" />
      <div ref={box} className="glass relative w-full max-w-[380px] rounded-3xl p-6 shadow-2xl animate-rise">
        <div className="flex flex-col items-center text-center">
          <img src="/futes-crest.jpg" alt="FUTES crest" className="h-20 w-20 rounded-2xl object-cover ring-1 ring-border shadow-[var(--shadow-glow)]" />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">FUTES <span className="text-primary">Nexus</span></h1>
          <p className="mt-1 text-xs text-muted-foreground">Sign in with your level and course</p>
          <p className="mt-3 font-display text-sm font-semibold">We built: <span className="animate-hue glow-text">Agentic AI · Automation</span></p>
        </div>

        <div className="mt-6 space-y-3">
          {/* Level */}
          <div className="relative">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your level</label>
            <button type="button" className={field} onClick={() => setOpen(open === "level" ? null : "level")} aria-expanded={open === "level"}>
              <Layers className="h-4 w-4 text-primary" />
              <span className={level ? "flex-1" : "flex-1 text-muted-foreground"}>{level || "Choose 100 or 200 Level"}</span>
              <ChevronDown className={`h-4 w-4 transition ${open === "level" ? "rotate-180" : ""}`} />
            </button>
            {open === "level" && (
              <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
                {LEVELS.map((l) => (
                  <button key={l} type="button" onClick={() => { setLevel(l); setOpen(null); }} className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-primary/15">
                    {l}{level === l && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Course */}
          <div className="relative">
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Your course</label>
            <button type="button" className={field} onClick={() => setOpen(open === "course" ? null : "course")} aria-expanded={open === "course"}>
              <GraduationCap className="h-4 w-4 text-primary" />
              <span className={`flex-1 truncate ${course ? "" : "text-muted-foreground"}`}>{course ? courseName(course) : "Choose your course"}</span>
              <ChevronDown className={`h-4 w-4 transition ${open === "course" ? "rotate-180" : ""}`} />
            </button>
            {open === "course" && (
              <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 35 courses…" className="w-full bg-transparent py-1 text-sm outline-none" />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {list.map((c) => (
                    <button key={c.name} type="button" onClick={() => { setCourse(c.name); setOpen(null); setQ(""); }} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-primary/15">
                      <span>{courseName(c.name)} <span className="text-[10px] text-muted-foreground">{c.name.startsWith("B.Eng") ? "B.Eng" : "B.Sc"}</span></span>
                      {course === c.name && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  ))}
                  {!list.length && <p className="px-4 py-3 text-xs text-muted-foreground">No course matches.</p>}
                </div>
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
            I agree to use Nexus respectfully and follow FUTES student policy.
          </label>

          <button
            type="button"
            onClick={enter}
            disabled={!ready && !loading}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-display text-sm font-semibold text-primary-foreground transition disabled:opacity-40 ${ready || loading ? "shadow-[var(--shadow-glow)] hover:brightness-110" : ""}`}
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing your feed…</> : "Enter Nexus"}
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <img src="/mww-logo.jpg" alt="MWW Studio" className="h-5 w-5 rounded-full object-cover" />
          Built by MWW Studio
        </div>
      </div>
    </main>
  );
}
