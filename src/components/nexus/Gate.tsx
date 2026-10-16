import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, ShieldCheck, Loader2, Sparkles } from "lucide-react";
import { COURSES, FACULTIES, LEVELS, courseName, type Level } from "@/lib/nexus-data";
import { cn } from "@/lib/utils";

const WORDS = ["Agentic AI", "Automation", "AI"];

function Typer() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const w = WORDS[i] ?? "";
    const t = setTimeout(
      () => {
        if (!del && n < w.length) setN(n + 1);
        else if (!del) setDel(true);
        else if (n > 0) setN(n - 1);
        else { setDel(false); setI((i + 1) % WORDS.length); }
      },
      !del && n === w.length ? 1400 : del ? 45 : 95,
    );
    return () => clearTimeout(t);
  }, [n, del, i]);
  return (
    <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
      <span className="text-muted-foreground">We built: </span>
      <span className="animate-hue glow-text">{(WORDS[i] ?? "").slice(0, n)}</span>
      <span className="ml-1 inline-block h-[0.9em] w-[3px] translate-y-1 animate-pulse bg-accent" />
    </h1>
  );
}

export function Gate({ onEnter }: { onEnter: (p: { level: Level; course: string; faculty: string }) => void }) {
  const [level, setLevel] = useState<Level | null>(null);
  const [faculty, setFaculty] = useState<string>("All");
  const [course, setCourse] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [agree, setAgree] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [progress, setProgress] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () => COURSES.filter((c) => (faculty === "All" || c.faculty === faculty) && c.name.toLowerCase().includes(q.toLowerCase())),
    [faculty, q],
  );
  const ready = !!level && !!course && agree;

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const launch = () => {
    if (!ready || launching) return;
    setLaunching(true);
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / 3200) * 100);
      setProgress(p);
      if (p >= 100) {
        clearInterval(id);
        onEnter({ level: level!, course: course!, faculty: COURSES.find((c) => c.name === course)!.faculty });
      }
    }, 50);
  };
  const steps = ["Verifying level", "Linking course matrix", "Caching your digest", "Waking the orb"];

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 animate-float rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-[28rem] w-[28rem] animate-float rounded-full bg-accent/10 blur-3xl [animation-delay:-3s]" />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/futes-crest.jpg" alt="FUTES crest" className="h-14 w-14 shrink-0 rounded-full shadow-[var(--shadow-glow)] ring-1 ring-primary/40 sm:h-16 sm:w-16" />
          <div className="min-w-0">
            <p className="truncate font-mono text-sm tracking-[0.3em] text-foreground sm:text-base">FUTES // NEXUS</p>
            <p className="truncate text-xs text-muted-foreground">Student gate · Iyin-Ekiti</p>
          </div>
        </div>
        <span className="hidden rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">Hackathon demo</span>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-16">
        <section className="animate-rise space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Something good is cooking
          </span>
          <Typer />
          <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
            Your course, your level, your daily study digest — plus student jobs, your timetable and a Jarvis-style assistant. Works even when your data runs out.
          </p>
        </section>

        <section className="glass animate-rise rounded-3xl p-5 shadow-2xl [animation-delay:.15s] sm:p-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">01 · Academic level</p>
          <div className="grid grid-cols-2 gap-3">
            {LEVELS.map((l) => (
              <button key={l} onClick={() => setLevel(l)}
                className={cn("rounded-2xl border px-4 py-5 text-left transition-all",
                  level === l ? "border-primary bg-primary/15 shadow-[var(--shadow-glow)]" : "border-border bg-secondary/40 hover:border-primary/40")}>
                <span className="block font-display text-3xl font-bold">{l.split(" ")[0]}</span>
                <span className="text-xs text-muted-foreground">Level</span>
              </button>
            ))}
          </div>

          <p className="mb-3 mt-7 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">02 · Faculty</p>
          <div className="flex flex-wrap gap-2">
            {["All", ...FACULTIES].map((f) => (
              <button key={f} onClick={() => { setFaculty(f); setCourse(null); }}
                className={cn("rounded-full border px-3 py-1.5 text-xs transition", faculty === f ? "border-accent bg-accent/15 text-accent" : "border-border text-muted-foreground hover:text-foreground")}>
                {f}
              </button>
            ))}
          </div>

          <p className="mb-3 mt-7 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">03 · Course</p>
          <div ref={box} className="relative">
            <button onClick={() => setOpen(!open)}
              className={cn("flex w-full items-center justify-between gap-3 rounded-2xl border bg-secondary/40 px-5 py-5 text-left transition", open ? "border-primary" : "border-border hover:border-primary/40")}>
              <span className={cn("min-w-0 truncate text-base sm:text-lg", !course && "text-muted-foreground")}>{course ?? "Select your course"}</span>
              <ChevronDown className={cn("h-5 w-5 shrink-0 transition", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-primary/30 bg-popover shadow-[var(--shadow-glow)]">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 35 courses…" className="w-full bg-transparent text-sm outline-none" />
                </div>
                <ul className="max-h-72 overflow-y-auto p-2">
                  {list.map((c) => (
                    <li key={c.name}>
                      <button onClick={() => { setCourse(c.name); setOpen(false); setQ(""); }}
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-primary/10">
                        <span className="min-w-0">
                          <span className="block truncate text-sm">{courseName(c.name)}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{c.name.split(" ")[0]} · {c.faculty}</span>
                        </span>
                        {course === c.name && <Check className="h-4 w-4 shrink-0 text-accent" />}
                      </button>
                    </li>
                  ))}
                  {!list.length && <li className="px-3 py-4 text-sm text-muted-foreground">No course matches.</li>}
                </ul>
              </div>
            )}
          </div>

          <label className={cn("mt-7 flex cursor-pointer gap-3 rounded-2xl border p-4 transition", agree ? "border-emerald/50 bg-emerald/5" : "border-border")}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="sr-only" />
            <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border", agree ? "border-emerald bg-emerald text-graphite" : "border-muted-foreground")}>
              {agree && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="text-sm text-muted-foreground">
              <ShieldCheck className="mr-1 inline h-4 w-4 text-emerald" />
              I understand this is a <b className="text-foreground">demo</b>: posts, jobs and timetable are sample content, my choices are saved only on this device, and I'll use the community respectfully.
            </span>
          </label>

          <button onClick={launch} disabled={!ready}
            className={cn("relative mt-6 w-full overflow-hidden rounded-2xl py-5 font-display text-lg font-semibold transition-all",
              ready ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:scale-[1.01]" : "cursor-not-allowed bg-secondary text-muted-foreground")}>
            {launching && <span className="absolute inset-y-0 left-0 bg-accent/30 transition-[width]" style={{ width: `${progress}%` }} />}
            <span className="relative flex items-center justify-center gap-2">
              {launching ? (<><Loader2 className="h-5 w-5 animate-spin" />{steps[Math.min(3, Math.floor(progress / 25))]}… {Math.round(progress)}%</>) : ready ? "Enter Nexus" : "Complete the steps to unlock"}
            </span>
          </button>
        </section>
      </main>

      <footer className="relative z-10 flex items-center justify-center gap-2 pb-6 text-xs text-muted-foreground">
        <img src="/mww-logo.jpg" alt="MWW Studio" className="h-6 w-6 rounded" /> Built by MWW Studio
      </footer>
    </div>
  );
}
