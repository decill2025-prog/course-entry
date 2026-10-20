import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Atom, BadgeCheck, Bell, BookOpen, Brain, Building2, CheckCircle2, ChevronDown, Circle, Cog, Cpu, Dna, Eye,
  FlaskConical, GraduationCap, Headphones, Home, Library, Lightbulb, LogOut, Mic, Pause, Pin, Send, Share2, ShieldAlert, Sigma, Square, WifiOff, X,
} from "lucide-react";
import { CLEARANCE, COURSES, LEVELS, TIMETABLE, courseName, type Level } from "@/lib/nexus-data";
import { groupOf, lessonsFor, type Icon, type Lesson } from "@/lib/lessons";
import { askJarvis, speak, transcribe } from "@/lib/ai.functions";

export type Profile = { level: Level; course: string; faculty: string };
const ICONS: Record<Icon, typeof Cpu> = { cpu: Cpu, flask: FlaskConical, atom: Atom, sigma: Sigma, book: BookOpen, cog: Cog, building: Building2, dna: Dna };
const NEWS_ID = "futes-news";

/** One shared audio player so only one voice plays at a time. */
let player: HTMLAudioElement | null = null;
async function playVoice(text: string, onEnd?: () => void): Promise<boolean> {
  player?.pause();
  const { audio, mime } = await speak({ data: { text } });
  if (!audio) return false;
  const a = new Audio(`data:${mime};base64,${audio}`);
  player = a;
  a.onended = () => onEnd?.();
  await a.play();
  return true;
}
const stopVoice = () => { player?.pause(); player = null; };

async function sharePost(id: string, title: string) {
  const url = `${window.location.origin}/?post=${id}`;
  const text = `${title} — on FUTES Nexus`;
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } }
  catch (e) { if ((e as Error).name === "AbortError") return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast.success("Link copied — paste it in your class group"); }
  catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank"); }
}

function Avatar({ gold, faculty, size = 40 }: { gold?: boolean | undefined; faculty?: string | undefined; size?: number }) {
  const src = gold ? "/futes-crest.jpg" : `/ai/${faculty ? groupOf(faculty) : "general"}.jpg`;
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className={`shrink-0 rounded-full object-cover ring-2 ${gold ? "ring-gold" : "ring-primary/70"}`} />;
}

function Author({ gold, faculty, name, meta }: { gold?: boolean | undefined; faculty?: string | undefined; name: string; meta: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar gold={gold} faculty={faculty} />
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[15px] font-semibold leading-tight">
          <span className="truncate">{name}</span>
          <BadgeCheck className={`h-4 w-4 shrink-0 ${gold ? "fill-gold text-graphite" : "fill-primary text-primary-foreground"}`} aria-label="Verified" />
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function Visual({ l }: { l: Lesson }) {
  const I = ICONS[l.icon];
  return (
    <div className="relative aspect-square overflow-hidden" style={{ background: `radial-gradient(circle at 75% 20%, oklch(0.62 0.2 ${l.hue}), oklch(0.22 0.07 ${l.hue + 25}) 72%)` }}>
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(oklch(1_0_0/14%)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/14%)_1px,transparent_1px)] [background-size:28px_28px]" />
      <I className="absolute -right-6 -top-6 h-48 w-48 text-foreground/15" strokeWidth={1} />
      <div className="absolute inset-x-5 top-5 flex items-center justify-between">
        <span className="rounded-full bg-background/70 px-3 py-1 font-mono text-xs font-semibold">{l.code}</span>
        <span className="text-xs font-medium text-foreground/80">{l.tag}</span>
      </div>
      <div className="absolute inset-x-5 bottom-5">
        <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">{l.title}</p>
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-background/70 p-3 text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span className="leading-snug">{l.trick}</span>
        </div>
      </div>
    </div>
  );
}

function Actions({ playing, onListen, onView, onShare }: { playing: boolean; onListen: () => void; onView: () => void; onShare: () => void }) {
  const b = "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors active:scale-[0.97]";
  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      <button onClick={onListen} className={`${b} ${playing ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"}`}>
        {playing ? <Pause className="h-4 w-4" /> : <Headphones className="h-4 w-4" />} {playing ? "Stop" : "Listen"}
      </button>
      <button onClick={onView} className={`${b} bg-primary/15 text-primary hover:bg-primary/25`}><Eye className="h-4 w-4" /> View</button>
      <button onClick={onShare} className={`${b} bg-secondary hover:bg-secondary/70`}><Share2 className="h-4 w-4" /> Share</button>
    </div>
  );
}

function NexusOrb({ size }: { size: number }) {
  return (
    <span className="jarvis block" style={{ width: size, height: size }}>
      <span className="jarvis-ring" style={{ inset: 3 }} />
      <span className="jarvis-ring-rev" style={{ inset: size * 0.17 }} />
      <span className="jarvis-core" style={{ inset: size * 0.3 }} />
    </span>
  );
}

export function Hub({ profile, onSwitch, onExit }: { profile: Profile; onSwitch: (p: Profile) => void; onExit: () => void }) {
  const [tab, setTab] = useState<"feed" | "vault">("feed");
  const [view, setView] = useState<string | null>(null);
  const [checklist, setChecklist] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [orb, setOrb] = useState(false);
  const [online, setOnline] = useState(true);
  const [done, setDone] = useState<number[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [bell, setBell] = useState(false);
  const [rounds, setRounds] = useState(1);
  const [hidden, setHidden] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const course = courseName(profile.course);
  const lvl = profile.level.replace(" Level", "L");
  const lessons = useMemo(() => lessonsFor(profile.level, profile.faculty), [profile.level, profile.faculty]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    try { setDone(JSON.parse(localStorage.getItem("nexus.clearance") || "[]")); } catch { /* ignore */ }
    const id = new URLSearchParams(window.location.search).get("post");
    if (id === NEWS_ID) setChecklist(true); else if (id) setView(id);
    let last = window.scrollY, ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) > 10) { setHidden(y > last && y > 140); last = y; }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("scroll", onScroll); stopVoice(); };
  }, []);

  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setRounds((r) => Math.min(r + 1, 20)); }, { rootMargin: "800px" });
    io.observe(el); return () => io.disconnect();
  }, [tab]);

  // Lock page scroll under overlays so nothing jumps behind them.
  const overlay = !!view || checklist || orb || switcher || bell;
  useEffect(() => { document.body.style.overflow = overlay ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [overlay]);

  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next); localStorage.setItem("nexus.clearance", JSON.stringify(next));
  };

  const listen = async (l: Lesson) => {
    if (playing === l.id) { stopVoice(); setPlaying(null); return; }
    setPlaying(l.id);
    try {
      const ok = await playVoice(`${l.title}. ${l.body} Memory trick: ${l.trick}`, () => setPlaying(null));
      if (!ok) { setPlaying(null); toast("Voice is unavailable right now — try again shortly."); }
    } catch { setPlaying(null); toast.error("Couldn't play audio — check your connection."); }
  };

  const viewed = lessons.find((p) => p.id === view);
  const closeView = () => { setView(null); history.replaceState(null, "", "/"); };
  const pct = Math.round((done.length / CLEARANCE.length) * 100);
  const go = (t: "feed" | "vault") => { setTab(t); window.scrollTo({ top: 0 }); setHidden(false); };

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-primary/15 bg-graphite/95">
        <div className="mx-auto flex h-[68px] max-w-xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/futes-crest.jpg" alt="FUTES" className="h-11 w-11 rounded-xl object-cover ring-1 ring-primary/30" />
            <div className="min-w-0 leading-tight">
              <p className="font-display text-[17px] font-bold tracking-wide">FUTES <span className="text-primary">// NEXUS</span></p>
              <button onClick={() => setSwitcher(true)} className="mt-0.5 flex max-w-full items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${online ? "bg-emerald" : "bg-warning"}`} />
                <span className="truncate">{lvl} · {course}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </button>
            </div>
          </div>
          <button aria-label="Notifications" onClick={() => setBell(true)} className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary/70 hover:bg-secondary">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 animate-pulse rounded-full bg-primary ring-2 ring-graphite" />
          </button>
        </div>
        {!online && <div className="flex items-center justify-center gap-2 bg-warning py-1.5 text-xs font-medium text-graphite"><WifiOff className="h-3.5 w-3.5" /> You're offline — showing saved posts</div>}
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-3 pb-36 pt-[84px]">
        {tab === "feed" ? (
          <>
            <article className="card-solid gold-ring overflow-hidden rounded-3xl animate-fade">
              <div className="p-4">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-gold"><Pin className="h-3.5 w-3.5" /> Pinned by FUTES News</div>
                <Author gold name="FUTES News" meta="Official campus press · Freshers" />
                <h2 className="mt-3 font-display text-xl font-bold">TO THE FRESHERS ✅❤️</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-foreground/85">Your clearance steps for 2025/2026. Tick them off as you go — progress saves on this phone, even offline.</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} /></div>
                <p className="mt-1.5 text-xs text-muted-foreground">{done.length} of {CLEARANCE.length} done</p>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 pt-0">
                <button onClick={() => setChecklist(true)} className="flex items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-sm font-semibold text-graphite"><Eye className="h-4 w-4" /> Open checklist</button>
                <button onClick={() => sharePost(NEWS_ID, "TO THE FRESHERS — FUTES clearance steps")} className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-semibold"><Share2 className="h-4 w-4" /> Share</button>
              </div>
            </article>

            {Array.from({ length: rounds }).flatMap((_, r) => lessons.map((l, i) => {
              const n = r * lessons.length + i;
              return (
                <article key={`${l.id}-${r}`} className="feed-card card-solid overflow-hidden rounded-3xl">
                  <div className="p-4 pb-3">
                    <Author faculty={profile.faculty} name={`Nexus AI · ${course}`} meta={`${r ? "Revision · " : ""}${n * 7 + 3}m · ${lvl} · ${l.code}`} />
                    <p className="mt-3 text-[15px] leading-relaxed text-foreground/90">{l.body}</p>
                  </div>
                  <button onClick={() => setView(l.id)} className="block w-full text-left" aria-label={`View ${l.title}`}><Visual l={l} /></button>
                  <Actions playing={playing === l.id} onListen={() => listen(l)} onView={() => setView(l.id)} onShare={() => sharePost(l.id, l.title)} />
                </article>
              );
            }))}
            <div ref={sentinel} className="py-6 text-center text-xs text-muted-foreground">Loading more for {lvl} {course}…</div>
          </>
        ) : (
          <Vault lessons={lessons} course={course} lvl={lvl} faculty={profile.faculty} onOpen={setView} onAsk={() => setOrb(true)} />
        )}
      </main>

      {/* Bottom dock — slides away on scroll down; orb shrinks in place (transform only, no layout jumps) */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
        <div className="relative h-[68px] w-full max-w-[320px]">
          <div className={`dock-glass pointer-events-auto absolute inset-0 grid grid-cols-3 items-center rounded-[28px] transition-[transform,opacity] duration-300 ease-out will-change-transform ${hidden ? "translate-y-[130%] opacity-0" : ""}`}>
            <button onClick={() => go("feed")} className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold ${tab === "feed" ? "text-primary" : "text-muted-foreground"}`}><Home className="h-5 w-5" /> Feed</button>
            <span />
            <button onClick={() => go("vault")} className={`flex flex-col items-center gap-0.5 text-[11px] font-semibold ${tab === "vault" ? "text-primary" : "text-muted-foreground"}`}><Library className="h-5 w-5" /> Study Vault</button>
          </div>
          <button
            onClick={() => setOrb(true)}
            aria-label="Open Nexus"
            className={`pointer-events-auto absolute left-1/2 top-0 -ml-[38px] -mt-[30px] rounded-full bg-graphite p-1.5 ring-1 ring-primary/30 transition-transform duration-300 ease-out will-change-transform ${hidden ? "translate-y-[40px] scale-[0.72]" : ""}`}
          >
            <NexusOrb size={64} />
          </button>
        </div>
      </nav>

      {viewed && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-canvas animate-fade">
          <div className="mx-auto max-w-xl pb-12">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-graphite/95 px-3 py-3">
              <button onClick={closeView} className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              <span className="font-display font-semibold">{viewed.code} · Lesson</span>
            </div>
            <Visual l={viewed} />
            <div className="space-y-4 p-4">
              <Author faculty={profile.faculty} name={`Nexus AI · ${course}`} meta={`${lvl} · ${viewed.tag}`} />
              <h1 className="text-shimmer font-display text-3xl font-bold leading-tight">{viewed.title}</h1>
              <p className="text-[17px] leading-8 text-foreground/90">{viewed.body}</p>
              <Actions playing={playing === viewed.id} onListen={() => listen(viewed)} onView={() => document.getElementById("trick")?.scrollIntoView({ behavior: "smooth" })} onShare={() => sharePost(viewed.id, viewed.title)} />
              <div id="trick" className="rounded-3xl border border-gold/30 bg-gold/10 p-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold"><Brain className="h-4 w-4" /> Memory trick</p>
                <p className="mt-2 font-display text-xl font-bold leading-snug">{viewed.trick}</p>
              </div>
              <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-5">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-destructive"><ShieldAlert className="h-4 w-4" /> Exam trap</p>
                <p className="mt-2 text-[15px] leading-7">{viewed.trap}</p>
              </div>
              <div className="card-solid rounded-3xl p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Lock it in</p>
                <ul className="mt-3 space-y-2.5">
                  {viewed.points.map((p) => <li key={p} className="flex items-center gap-3 text-[15px]"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> {p}</li>)}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">Close your eyes, say the trick out loud, then recall the 3 points. That's it — it sticks.</p>
              </div>
              <button onClick={() => { closeView(); setOrb(true); }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground"><Mic className="h-4 w-4" /> Still confused? Ask Nexus</button>
            </div>
          </div>
        </div>
      )}

      {checklist && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-canvas animate-fade">
          <div className="mx-auto max-w-xl pb-12">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-graphite/95 px-3 py-3">
              <button onClick={() => { setChecklist(false); history.replaceState(null, "", "/"); }} className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              <span className="font-display font-semibold">FUTES News · Clearance</span>
              <span className="ml-auto rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-graphite">{pct}%</span>
            </div>
            <div className="space-y-2 p-4">
              {CLEARANCE.map((c, i) => {
                const ok = done.includes(i);
                return (
                  <button key={c} onClick={() => toggle(i)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-[15px] transition-colors ${ok ? "border-gold/40 bg-gold/10" : "border-border bg-secondary/40 hover:bg-secondary"}`}>
                    {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                    <span className={`flex-1 ${ok ? "text-muted-foreground line-through" : ""}`}>{c}</span>
                  </button>
                );
              })}
              <p className="pt-2 text-[11px] text-muted-foreground">Confirm each step with the official FUTES notice.</p>
            </div>
          </div>
        </div>
      )}

      {switcher && <Switcher profile={profile} onClose={() => setSwitcher(false)} onExit={onExit} onSave={(p) => { setSwitcher(false); setRounds(1); window.scrollTo({ top: 0 }); onSwitch(p); toast.success(`Switched to ${p.level.replace(" Level", "L")} · ${courseName(p.course)}`); }} />}

      {orb && <Nexus lessons={lessons} course={course} level={profile.level} faculty={profile.faculty}
        onClose={() => { stopVoice(); setOrb(false); }}
        onOpen={(id) => { setOrb(false); if (id === "checklist") setChecklist(true); else if (id === "vault") go("vault"); else setView(id); }}
        onNote={(n) => setNotes((x) => [n, ...x])} />}

      {bell && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 p-4 pt-20" onClick={() => setBell(false)}>
          <div className="card-solid w-full max-w-sm rounded-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg font-bold">Notifications</p>
            <div className="mt-3 space-y-2 text-sm">
              {notes.map((n, i) => <p key={i} className="rounded-2xl bg-secondary/60 p-3">{n}</p>)}
              <p className="rounded-2xl bg-secondary/60 p-3">📌 FUTES News pinned the fresher clearance steps.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Vault({ lessons, course, lvl, faculty, onOpen, onAsk }: { lessons: Lesson[]; course: string; lvl: string; faculty: string; onOpen: (id: string) => void; onAsk: () => void }) {
  const [flip, setFlip] = useState<string | null>(null);
  return (
    <>
      <section className="card-solid relative overflow-hidden rounded-3xl p-5 animate-fade">
        <div className="flex items-center gap-4">
          <Avatar faculty={faculty} size={56} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Study Vault</p>
            <p className="text-shimmer mt-0.5 truncate font-display text-xl font-bold">{course}</p>
            <p className="text-xs text-muted-foreground">{lvl} scheme of work · {lessons.length} topics</p>
          </div>
        </div>
        <button onClick={onAsk} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground"><Mic className="h-4 w-4" /> Ask your course tutor</button>
      </section>

      <section className="card-solid rounded-3xl p-4">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold"><GraduationCap className="h-5 w-5 text-primary" /> Scheme of work</h3>
        <div className="mt-2 divide-y divide-border">
          {lessons.map((l, i) => (
            <button key={l.id} onClick={() => onOpen(l.id)} className="flex w-full items-center gap-3 py-3 text-left">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 font-mono text-xs font-bold text-primary">W{i + 1}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{l.title}</p><p className="text-xs text-muted-foreground">{l.code} · {l.tag}</p></div>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <section className="card-solid rounded-3xl p-4">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold"><Brain className="h-5 w-5 text-gold" /> Memory deck</h3>
        <p className="text-xs text-muted-foreground">Tap a card to reveal the trick.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {lessons.map((l) => (
            <button key={l.id} onClick={() => setFlip(flip === l.id ? null : l.id)} className={`min-h-28 rounded-2xl border p-3 text-left text-sm transition-colors ${flip === l.id ? "border-gold/40 bg-gold/10" : "border-border bg-secondary/40"}`}>
              <p className="font-mono text-[11px] font-semibold text-primary">{l.code}</p>
              <p className="mt-1 leading-snug">{flip === l.id ? l.trick : l.title}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card-solid rounded-3xl p-4">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldAlert className="h-5 w-5 text-destructive" /> Exam trap bank</h3>
        <div className="mt-2 space-y-2">
          {lessons.map((l) => <div key={l.id} className="rounded-2xl bg-destructive/10 p-3 text-sm"><p className="font-mono text-[11px] font-semibold text-destructive">{l.code}</p><p className="mt-1 leading-relaxed">{l.trap}</p></div>)}
        </div>
      </section>

      <section className="card-solid rounded-3xl p-4">
        <h3 className="font-display text-lg font-bold">This week's lectures</h3>
        <div className="mt-2 divide-y divide-border">
          {TIMETABLE.map((t) => (
            <div key={t.day + t.code} className="flex items-center gap-3 py-3 text-sm">
              <span className="w-10 font-mono text-xs font-semibold text-primary">{t.day}</span>
              <div className="flex-1"><p className="font-semibold">{t.code}</p><p className="text-xs text-muted-foreground">{t.room}</p></div>
              <span className="text-xs text-muted-foreground">{t.time}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Sample timetable — send your department's to replace it.</p>
      </section>
    </>
  );
}

function Switcher({ profile, onClose, onSave, onExit }: { profile: Profile; onClose: () => void; onSave: (p: Profile) => void; onExit: () => void }) {
  const [level, setLevel] = useState<Level>(profile.level);
  const [course, setCourse] = useState(profile.course);
  const [q, setQ] = useState("");
  const list = COURSES.filter((c) => courseName(c.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 sm:items-center" onClick={onClose}>
      <div className="card-solid flex max-h-[80dvh] w-full max-w-md flex-col rounded-t-[2rem] p-4 sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold">Switch level & course</p>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {LEVELS.map((l) => <button key={l} onClick={() => setLevel(l)} className={`rounded-xl py-2.5 text-sm font-semibold ${level === l ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{l}</button>)}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 35 courses…" className="mt-3 rounded-xl border border-border bg-input/40 px-3 py-2.5 text-[15px] outline-none focus:border-primary" />
        <div className="mt-2 flex-1 overflow-y-auto overscroll-contain">
          {list.map((c) => (
            <button key={c.name} onClick={() => setCourse(c.name)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${course === c.name ? "bg-primary/15 text-primary" : "hover:bg-secondary"}`}>
              <span>{courseName(c.name)}</span>{course === c.name && <CheckCircle2 className="h-4 w-4" />}
            </button>
          ))}
        </div>
        <button onClick={() => onSave({ level, course, faculty: COURSES.find((c) => c.name === course)?.faculty ?? profile.faculty })} className="mt-3 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground">Switch now</button>
        <button onClick={onExit} className="mt-2 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground"><LogOut className="h-3.5 w-3.5" /> Back to gate</button>
      </div>
    </div>
  );
}

type Msg = { from: "ai" | "me"; text: string };

function Nexus({ lessons, course, level, faculty, onClose, onOpen, onNote }: { lessons: Lesson[]; course: string; level: Level; faculty: string; onClose: () => void; onOpen: (id: string) => void; onNote: (n: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "ai", text: `Hey, I'm Nexus — your ${course} coursemate. Ask me anything, or tap the mic.` }]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const rec = useRef<MediaRecorder | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, state]);
  useEffect(() => () => { rec.current?.state === "recording" && rec.current.stop(); }, []);
  const chips = [`Explain ${lessons[0]?.code ?? "my course"} simply`, "Open my clearance", "Draft acceptance letter"];

  // Local intents: 0 API calls, instant.
  const local = (t: string) => {
    const post = lessons.find((p) => t.includes(p.code.toLowerCase()) && /open|show|go/.test(t));
    if (post) return { text: `Roger. Opening ${post.code}.`, act: () => onOpen(post.id) };
    if (/clearance|checklist|fresher/.test(t)) return { text: "On it. Opening your clearance.", act: () => onOpen("checklist") };
    if (/vault|timetable|scheme/.test(t)) return { text: "Roger. Study Vault.", act: () => onOpen("vault") };
    if (/draft|letter|document/.test(t)) return { text: "Done. It's in your notifications.", act: () => onNote(`📄 Draft ready: "Letter of Acceptance — ${course}".`) };
    return null;
  };

  const say = async (text: string) => {
    setState("speaking");
    try { const ok = await playVoice(text, () => setState("idle")); if (!ok) setState("idle"); } catch { setState("idle"); }
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || state === "thinking") return;
    const history = msgs.slice(-6).map((m) => ({ role: m.from === "ai" ? ("assistant" as const) : ("user" as const), content: m.text }));
    setMsgs((m) => [...m, { from: "me", text: q }]); setInput("");
    const l = local(q.toLowerCase());
    if (l) { setMsgs((m) => [...m, { from: "ai", text: l.text }]); void say(l.text); setTimeout(l.act, 700); return; }
    if (!navigator.onLine) { const t = "You're offline. Open the Study Vault — your tricks and traps are saved there."; setMsgs((m) => [...m, { from: "ai", text: t }]); return; }
    setState("thinking");
    try {
      const r = await askJarvis({ data: { question: q, course, level, history } });
      const t = r.text ?? (r.error === "busy" ? "Lots of students asking right now — give me 10 seconds and ask again." : "I couldn't reach my brain just now. Try again.");
      setMsgs((m) => [...m, { from: "ai", text: t }]);
      if (r.text) void say(r.text); else setState("idle");
    } catch { setMsgs((m) => [...m, { from: "ai", text: "Connection dropped. Try again." }]); setState("idle"); }
  };

  const mic = async () => {
    if (state === "listening") { rec.current?.stop(); return; }
    stopVoice();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("thinking");
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        try {
          const { text } = await transcribe({ data: { audio: btoa(bin), mime: blob.type } });
          setState("idle");
          if (text) void send(text); else toast("Didn't catch that — try again.");
        } catch { setState("idle"); toast.error("Voice failed — check your connection."); }
      };
      rec.current = mr; mr.start(); setState("listening");
      setTimeout(() => mr.state === "recording" && mr.stop(), 12000);
    } catch { toast.error("Allow microphone access to talk to Nexus."); }
  };

  const label = { idle: "Tap the mic and talk", listening: "Listening… tap to send", thinking: "Thinking…", speaking: "Speaking…" }[state];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/85 animate-fade" onClick={onClose}>
      <div className="card-solid flex h-[78dvh] w-full max-w-xl flex-col rounded-t-[2rem] px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex h-[132px] shrink-0 flex-col items-center justify-center gap-1.5">
          <div className={`transition-opacity duration-300 ${state === "idle" ? "opacity-90" : "opacity-100"}`}><NexusOrb size={80} /></div>
          <p className="flex items-center gap-1 font-display text-base font-bold">Nexus <BadgeCheck className="h-4 w-4 fill-primary text-primary-foreground" /><span className="ml-1 font-sans text-xs font-normal text-muted-foreground">· {label}</span></p>
          <button onClick={onClose} aria-label="Close" className="absolute right-0 top-0 grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain py-2">
          {msgs.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.from === "me" ? "justify-end" : ""}`}>
              {m.from === "ai" && <Avatar faculty={faculty} size={26} />}
              <p className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${m.from === "ai" ? "bg-secondary" : "bg-primary text-primary-foreground"}`}>{m.text}</p>
            </div>
          ))}
          {state === "thinking" && <p className="ml-9 w-fit rounded-2xl bg-secondary px-3.5 py-2 text-sm text-muted-foreground">…</p>}
          <div ref={end} />
        </div>
        <div className="mb-2 flex shrink-0 gap-2 overflow-x-auto">
          {chips.map((c) => <button key={c} onClick={() => send(c)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary">{c}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-input/40 p-1.5">
          <button type="button" onClick={mic} aria-label={state === "listening" ? "Stop recording" : "Talk"} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${state === "listening" ? "animate-pulse bg-destructive text-destructive-foreground" : "bg-secondary"}`}>
            {state === "listening" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Nexus…" className="min-w-0 flex-1 bg-transparent px-1 text-[16px] outline-none" />
          <button type="submit" aria-label="Send" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}
