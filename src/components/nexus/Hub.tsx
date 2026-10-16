import { useEffect, useMemo, useState } from "react";
import { Atom, Bell, BookOpen, Briefcase, CalendarDays, Cpu, FlaskConical, Heart, Mail, Newspaper, Search, Share2, Sigma, Volume2, X, LogOut } from "lucide-react";
import { JOBS, POSTS, TIMETABLE, isExpired, courseName, type Level } from "@/lib/nexus-data";
import { cn } from "@/lib/utils";

type Tab = "feed" | "jobs" | "timetable";
type Sheet = null | "messages" | "alerts" | "orb";
const ICONS = { cpu: Cpu, flask: FlaskConical, atom: Atom, sigma: Sigma, book: BookOpen };
const CACHE_KEY = "nexus.cachedAt";

export function Hub({ profile, onExit }: { profile: { level: Level; course: string }; onExit: () => void }) {
  const [tab, setTab] = useState<Tab>("feed");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [online, setOnline] = useState(true);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  useEffect(() => {
    const at = Number(localStorage.getItem(CACHE_KEY) || 0);
    if (!at || isExpired(at)) {
      if (navigator.onLine) localStorage.setItem(CACHE_KEY, String(Date.now()));
      else if (at) setExpired(true);
    }
    if (online) setExpired(false);
  }, [online]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const share = async (title: string) => {
    try {
      if (navigator.share) await navigator.share({ title, text: `${title} — FUTES Nexus` });
      else { await navigator.clipboard.writeText(`${title} — FUTES Nexus`); flash("Copied to clipboard"); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-canvas">
      {!online && (
        <div className="z-[60] bg-warning px-4 py-1.5 text-center text-xs font-semibold text-graphite">
          ⚠️ You are offline. Showing saved posts on this device.
        </div>
      )}
      <header className="glass z-50 flex shrink-0 items-center justify-between border-x-0 border-t-0 px-4 py-3 sm:px-8">
        <button onClick={() => setTab("feed")} className="flex min-w-0 items-center gap-3">
          <img src="/futes-crest.jpg" alt="FUTES crest" className="h-10 w-10 shrink-0 rounded-full ring-1 ring-primary/40" />
          <span className="truncate font-mono text-sm tracking-[0.25em]">FUTES // NEXUS</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <IconBtn label="Messages" onClick={() => setSheet("messages")}><Mail className="h-5 w-5" /></IconBtn>
          <IconBtn label="Notifications" onClick={() => setSheet("alerts")}>
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 animate-ping rounded-full bg-emerald" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald" />
          </IconBtn>
          <IconBtn label="Change course" onClick={onExit}><LogOut className="h-5 w-5" /></IconBtn>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-4 pb-32 pt-6">
          {tab === "feed" && (
            <>
              <div className="animate-rise">
                <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">Today's digest · {profile.level}</p>
                <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{courseName(profile.course)}</h2>
                <p className="mt-1 text-xs text-muted-foreground">Sample demo lessons · saved for offline reading for 72 hours</p>
              </div>
              {expired ? (
                <div className="glass rounded-3xl p-6 text-sm text-muted-foreground">Saved lessons expired after 72 hours. Reconnect to refresh them.</div>
              ) : POSTS.map((p, i) => {
                const Icon = ICONS[p.icon];
                return (
                  <article key={p.id} className="glass animate-rise overflow-hidden rounded-3xl" style={{ animationDelay: `${i * 0.08}s` }}>
                    <div className="relative grid aspect-video place-items-center overflow-hidden"
                      style={{ background: `radial-gradient(circle at 30% 30%, oklch(0.55 0.2 ${p.hue} / .7), transparent 60%), radial-gradient(circle at 80% 80%, oklch(0.6 0.15 ${p.hue + 40} / .5), transparent 55%), oklch(0.14 0.03 ${p.hue})` }}>
                      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(oklch(1_0_0/.15)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/.15)_1px,transparent_1px)] [background-size:32px_32px]" />
                      <Icon className="relative h-20 w-20 animate-float text-foreground/90 drop-shadow-[0_0_30px_currentColor]" strokeWidth={1.2} />
                      <span className="absolute bottom-3 left-4 font-mono text-3xl font-bold text-foreground/90">{p.code}</span>
                      <span className="absolute right-3 top-3 rounded-full bg-graphite/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Demo</span>
                    </div>
                    <div className="space-y-3 p-5">
                      <span className="inline-block rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">{p.tag}</span>
                      <h3 className="font-display text-xl font-semibold">{p.title}</h3>
                      <p className="leading-relaxed text-foreground/85">{p.body}</p>
                    </div>
                    <div className="grid grid-cols-3 border-t border-border">
                      <Action onClick={() => setLiked((l) => ({ ...l, [p.id]: !l[p.id] }))} active={liked[p.id]}>
                        <Heart className={cn("h-4 w-4", liked[p.id] && "fill-current")} /> Like
                      </Action>
                      <Action onClick={() => share(p.title)}><Share2 className="h-4 w-4" /> Share</Action>
                      <Action onClick={() => flash("Read aloud arrives with the premium voice update")}><Volume2 className="h-4 w-4" /> Listen</Action>
                    </div>
                  </article>
                );
              })}
            </>
          )}

          {tab === "jobs" && (
            <>
              <Title kicker="Student marketplace" title="Jobs & gigs" note="Sample listings — contact details unlock when accounts launch" />
              {JOBS.map((j, i) => (
                <div key={j.id} className="glass animate-rise flex items-center justify-between gap-4 rounded-2xl p-5" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="min-w-0">
                    <span className="text-[11px] uppercase tracking-wider text-accent">{j.tag} · {j.who}</span>
                    <p className="truncate font-semibold">{j.title}</p>
                  </div>
                  <span className="shrink-0 font-mono text-gold">{j.price}</span>
                </div>
              ))}
            </>
          )}

          {tab === "timetable" && (
            <>
              <Title kicker={profile.level} title="Lecture timetable" note="Demo slots — not the official FUTES timetable" />
              {TIMETABLE.map((t, i) => (
                <div key={i} className="glass animate-rise grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl p-4" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/15 font-display font-bold text-primary">{t.day}</div>
                  <div className="min-w-0">
                    <p className="font-semibold">{t.code} <span className="font-normal text-muted-foreground">· {t.time}</span></p>
                    <p className="truncate text-sm text-muted-foreground">{t.room}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </main>

      <nav className="glass fixed inset-x-0 bottom-0 z-50 flex h-20 items-center justify-between border-x-0 border-b-0 px-4 shadow-2xl sm:px-10">
        <NavBtn active={tab === "jobs"} onClick={() => setTab("jobs")}><Briefcase className="h-5 w-5" />Jobs</NavBtn>
        <NavBtn active={tab === "feed"} onClick={() => setTab("feed")} className="hidden sm:flex"><Newspaper className="h-5 w-5" />Feed</NavBtn>
        <button aria-label="Open Jarvis assistant" onClick={() => setSheet("orb")} className="relative -mt-10 grid h-20 w-20 shrink-0 place-items-center">
          <span className="absolute inset-0 animate-spin-slow rounded-full p-[3px] shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-orb)" }}>
            <span className="block h-full w-full rounded-full bg-graphite" />
          </span>
          <span className="absolute inset-3 animate-spin-slow rounded-full border border-accent/50 [animation-direction:reverse]" />
          <span className="absolute inset-5 rounded-full bg-primary/30 blur-sm" />
          <span className="relative h-3 w-3 animate-pulse rounded-full bg-accent shadow-[0_0_20px_6px] shadow-accent/70" />
        </button>
        <NavBtn active={tab === "feed"} onClick={() => setTab("feed")} className="sm:hidden"><Newspaper className="h-5 w-5" />Feed</NavBtn>
        <NavBtn active={tab === "timetable"} onClick={() => setTab("timetable")}><CalendarDays className="h-5 w-5" />Timetable</NavBtn>
      </nav>

      {sheet && <Panel sheet={sheet} onClose={() => setSheet(null)} go={(t) => { setTab(t); setSheet(null); }} />}
      {toast && <div className="fixed bottom-28 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-popover px-4 py-2 text-sm shadow-[var(--shadow-glow)]">{toast}</div>}
    </div>
  );
}

function Panel({ sheet, onClose, go }: { sheet: Exclude<Sheet, null>; onClose: () => void; go: (t: Tab) => void }) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return [];
    return [
      ...POSTS.filter((p) => `${p.code} ${p.title} ${p.body} ${p.tag}`.toLowerCase().includes(s)).map((p) => ({ k: p.id, t: `${p.code} · ${p.title}`, tab: "feed" as Tab })),
      ...JOBS.filter((j) => `${j.title} ${j.tag}`.toLowerCase().includes(s)).map((j) => ({ k: j.id, t: `Job · ${j.title}`, tab: "jobs" as Tab })),
      ...TIMETABLE.filter((t) => `${t.code} ${t.day} ${t.room}`.toLowerCase().includes(s)).map((t, i) => ({ k: `t${i}`, t: `Class · ${t.code} ${t.day} ${t.time}`, tab: "timetable" as Tab })),
    ];
  }, [q]);
  const titles = { messages: "Messages", alerts: "Notifications", orb: "Jarvis assistant" };
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-graphite/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="glass animate-rise max-h-[80dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-6 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">{titles[sheet]}</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        {sheet === "orb" && (
          <>
            <div className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-secondary/40 px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask: physics, calculator, Monday…" className="w-full bg-transparent outline-none" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Chemistry", "Tutor", "Mon"].map((s) => <button key={s} onClick={() => setQ(s)} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">{s}</button>)}
            </div>
            <ul className="mt-4 space-y-2">
              {results.map((r) => <li key={r.k}><button onClick={() => go(r.tab)} className="w-full rounded-xl bg-secondary/40 px-4 py-3 text-left text-sm hover:bg-primary/15">{r.t}</button></li>)}
              {q && !results.length && <li className="text-sm text-muted-foreground">Nothing found on this device.</li>}
            </ul>
            <p className="mt-5 text-xs text-muted-foreground">Works offline by searching your saved lessons, jobs and classes. Voice chat and smarter AI answers are coming in a future update.</p>
          </>
        )}
        {sheet === "messages" && <p className="text-sm text-muted-foreground">No messages yet. Student-to-student chat unlocks when accounts launch.</p>}
        {sheet === "alerts" && (
          <ul className="space-y-2 text-sm">
            <li className="rounded-xl bg-secondary/40 p-3">📚 5 demo lessons saved for offline reading.</li>
            <li className="rounded-xl bg-secondary/40 p-3">💼 5 sample gigs in the Jobs board.</li>
            <li className="rounded-xl bg-secondary/40 p-3">📲 Add Nexus to your home screen to open it without data.</li>
          </ul>
        )}
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button aria-label={label} onClick={onClick} className="relative grid h-11 w-11 place-items-center rounded-full border border-border bg-secondary/40 transition hover:border-primary/50 hover:text-accent">{children}</button>;
}
function Action({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} className={cn("flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition hover:bg-secondary/40 active:scale-95", active ? "text-destructive" : "text-foreground/80")}>{children}</button>;
}
function NavBtn({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return <button onClick={onClick} className={cn("flex w-20 flex-col items-center gap-1 text-xs font-bold transition", active ? "text-accent" : "text-muted-foreground hover:text-foreground", className)}>{children}</button>;
}
function Title({ kicker, title, note }: { kicker: string; title: string; note: string }) {
  return (
    <div className="animate-rise">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">{kicker}</p>
      <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
