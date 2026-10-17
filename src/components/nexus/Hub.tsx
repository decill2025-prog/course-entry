import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Atom, BadgeCheck, Bell, BookOpen, Brain, Building2, CheckCircle2, Circle, Cog, Cpu, Dna, Eye,
  FlaskConical, Headphones, Home, Lightbulb, LogOut, MapPin, Pause, Pin, Send, Share2, ShieldAlert, Sigma, Sparkles, WifiOff, X,
} from "lucide-react";
import { CLEARANCE, TIMETABLE, courseName, type Level } from "@/lib/nexus-data";
import { lessonsFor, type Icon, type Lesson } from "@/lib/lessons";
import { speak } from "@/lib/tts.functions";

type Profile = { level: Level; course: string; faculty: string };
const ICONS: Record<Icon, typeof Cpu> = { cpu: Cpu, flask: FlaskConical, atom: Atom, sigma: Sigma, book: BookOpen, cog: Cog, building: Building2, dna: Dna };
const NEWS_ID = "futes-news";

const PHASES = [
  { name: "Before you arrive", where: "Online · JAMB CAPS & portal", steps: [0, 1, 2, 3] },
  { name: "Payments & documents", where: "Bursary · Registry", steps: [4, 5, 6, 7, 8] },
  { name: "On campus", where: "Health Centre · Department · ICT", steps: [9, 10, 11, 12] },
];

async function sharePost(id: string, title: string) {
  const url = `${window.location.origin}/?post=${id}`;
  const text = `${title} — on FUTES Nexus`;
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } }
  catch (e) { if ((e as Error).name === "AbortError") return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast.success("Link copied — paste it in your class group"); }
  catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank"); }
}

function Avatar({ gold, size = 10 }: { gold?: boolean | undefined; size?: number }) {
  const s = size === 10 ? "h-10 w-10" : "h-12 w-12";
  return gold
    ? <img src="/futes-crest.jpg" alt="" className={`${s} shrink-0 rounded-full object-cover ring-2 ring-gold`} />
    : <div className={`${s} grid shrink-0 place-items-center rounded-full bg-orb p-[2px]`}><div className="grid h-full w-full place-items-center rounded-full bg-sapphire font-display text-xs font-bold text-primary">AI</div></div>;
}

function Author({ gold, name, meta }: { gold?: boolean | undefined; name: string; meta: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar gold={gold} />
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
    <div className="relative aspect-square overflow-hidden" style={{ background: `radial-gradient(circle at 75% 20%, oklch(0.62 0.2 ${l.hue}) , oklch(0.22 0.07 ${l.hue + 25}) 72%)` }}>
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

function JarvisOrb({ size }: { size: number }) {
  return (
    <span className="jarvis block" style={{ width: size, height: size }}>
      <span className="jarvis-ring" style={{ inset: 3 }} />
      <span className="jarvis-ring-rev" style={{ inset: size * 0.17 }} />
      <span className="jarvis-core" style={{ inset: size * 0.3 }} />
    </span>
  );
}

export function Hub({ profile, onExit }: { profile: Profile; onExit: () => void }) {
  const [tab, setTab] = useState<"feed" | "fresher">("feed");
  const [view, setView] = useState<string | null>(null);
  const [orb, setOrb] = useState(false);
  const [online, setOnline] = useState(true);
  const [done, setDone] = useState<number[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [bell, setBell] = useState(false);
  const [rounds, setRounds] = useState(1);
  const [hidden, setHidden] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
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
    if (id) setView(id);
    let last = window.scrollY, ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (Math.abs(y - last) > 8) { setHidden(y > last && y > 120); last = y; }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("scroll", onScroll); audio.current?.pause(); };
  }, []);

  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) setRounds((r) => Math.min(r + 1, 20)); }, { rootMargin: "800px" });
    io.observe(el); return () => io.disconnect();
  }, [tab]);

  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next); localStorage.setItem("nexus.clearance", JSON.stringify(next));
  };

  const listen = async (l: Lesson) => {
    if (playing === l.id) { audio.current?.pause(); setPlaying(null); return; }
    audio.current?.pause(); setPlaying(l.id);
    try {
      const { audio: b64 } = await speak({ data: { text: `${l.title}. ${l.body} Memory trick: ${l.trick}` } });
      if (!b64) { setPlaying(null); toast("Voice turns on as soon as the Deepgram key is added."); return; }
      const a = new Audio(`data:audio/mpeg;base64,${b64}`);
      audio.current = a; a.onended = () => setPlaying(null); await a.play();
    } catch { setPlaying(null); toast.error("Couldn't play audio — check your connection."); }
  };

  const viewed = lessons.find((p) => p.id === view);
  const closeView = () => { setView(null); history.replaceState(null, "", "/"); };
  const pct = Math.round((done.length / CLEARANCE.length) * 100);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-graphite/90">
        <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/futes-crest.jpg" alt="FUTES" className="h-10 w-10 rounded-xl object-cover ring-1 ring-border" />
            <div className="min-w-0 leading-tight">
              <p className="font-display text-base font-bold tracking-wide">FUTES <span className="text-primary">// NEXUS</span></p>
              <p className="truncate text-[11px] text-muted-foreground">{lvl} · {course}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label="Notifications" onClick={() => setBell(true)} className="relative grid h-10 w-10 place-items-center rounded-full bg-secondary/60 hover:bg-secondary">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2.5 w-2.5 animate-pulse rounded-full bg-primary ring-2 ring-graphite" />
            </button>
            <button aria-label="Sign out" onClick={onExit} className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        {!online && <div className="flex items-center justify-center gap-2 bg-warning py-1.5 text-xs font-medium text-graphite"><WifiOff className="h-3.5 w-3.5" /> You're offline — showing saved posts</div>}
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-3 pb-36 pt-20">
        {tab === "feed" ? (
          <>
            <article className="card-solid gold-ring overflow-hidden rounded-3xl animate-rise">
              <div className="p-4">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-gold"><Pin className="h-3.5 w-3.5" /> Pinned by FUTES News</div>
                <Author gold name="FUTES News" meta="Official · For freshers" />
                <h2 className="mt-3 font-display text-xl font-bold">TO THE FRESHERS ✅❤️</h2>
                <p className="mt-1 text-[15px] leading-relaxed text-foreground/85">13 clearance steps every fresher must finish. Tick them off — progress saves on this phone.</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} /></div>
                <p className="mt-1.5 text-xs text-muted-foreground">{done.length} of {CLEARANCE.length} done</p>
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 pt-0">
                <button onClick={() => { setTab("fresher"); window.scrollTo(0, 0); }} className="flex items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-sm font-semibold text-graphite"><Eye className="h-4 w-4" /> Open checklist</button>
                <button onClick={() => sharePost(NEWS_ID, "TO THE FRESHERS — FUTES clearance steps")} className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-semibold"><Share2 className="h-4 w-4" /> Share</button>
              </div>
            </article>

            {Array.from({ length: rounds }).flatMap((_, r) => lessons.map((l, i) => {
              const n = r * lessons.length + i;
              return (
                <article key={`${l.id}-${r}`} className="card-solid overflow-hidden rounded-3xl">
                  <div className="p-4 pb-3">
                    <Author name={`Nexus AI · ${course}`} meta={`${r ? "Revision · " : ""}${n * 7 + 3}m · ${lvl} · ${l.code}`} />
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
          <>
            <section className="card-solid gold-ring relative overflow-hidden rounded-3xl p-5 animate-rise">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--secondary)" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${pct * 0.974} 100`} /></svg>
                  <span className="absolute inset-0 grid place-items-center font-display text-lg font-bold">{pct}%</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gold">Clearance passport</p>
                  <p className="mt-1 font-display text-lg font-bold leading-tight">{course}</p>
                  <p className="text-xs text-muted-foreground">{profile.level} · {done.length}/{CLEARANCE.length} cleared</p>
                </div>
              </div>
            </section>

            {PHASES.map((ph, pi) => {
              const cleared = ph.steps.filter((s) => done.includes(s)).length;
              return (
                <section key={ph.name} className="card-solid rounded-3xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Stage {pi + 1}</p>
                      <h3 className="font-display text-lg font-bold">{ph.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {ph.where}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cleared === ph.steps.length ? "bg-gold text-graphite" : "bg-secondary"}`}>{cleared}/{ph.steps.length}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {ph.steps.map((i) => {
                      const ok = done.includes(i);
                      return (
                        <button key={i} onClick={() => toggle(i)} className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-[15px] transition-colors ${ok ? "border-gold/40 bg-gold/10" : "border-border bg-secondary/40 hover:bg-secondary"}`}>
                          {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                          <span className={`flex-1 ${ok ? "text-muted-foreground line-through" : ""}`}>{CLEARANCE[i]}</span>
                          <span className={`text-[11px] font-semibold ${ok ? "text-gold" : "text-muted-foreground"}`}>{ok ? "Cleared" : "Pending"}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

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
              <p className="mt-2 text-[11px] text-muted-foreground">Sample steps and timetable — send the official list to replace them.</p>
            </section>
          </>
        )}
      </main>

      {/* Bottom dock: hides on scroll down, orb shrinks */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),14px)]">
        <div className={`pointer-events-auto relative mx-auto flex h-16 max-w-xs items-center justify-between rounded-full border border-border bg-graphite/95 px-10 shadow-2xl transition-transform duration-300 ${hidden ? "translate-y-[140%]" : ""}`}>
          <button onClick={() => { setTab("feed"); window.scrollTo(0, 0); }} className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${tab === "feed" ? "text-primary" : "text-muted-foreground"}`}><Home className="h-5 w-5" /> Feed</button>
          <button onClick={() => { setTab("fresher"); window.scrollTo(0, 0); }} className={`flex flex-col items-center gap-0.5 text-[11px] font-medium ${tab === "fresher" ? "text-gold" : "text-muted-foreground"}`}><Sparkles className="h-5 w-5" /> Freshers</button>
        </div>
        <button onClick={() => setOrb(true)} aria-label="Open Jarvis" className={`pointer-events-auto absolute left-1/2 rounded-full bg-graphite p-1.5 ring-1 ring-border transition-all duration-300 ${hidden ? "bottom-[max(env(safe-area-inset-bottom),14px)] -translate-x-1/2 scale-75" : "bottom-[calc(max(env(safe-area-inset-bottom),14px)+28px)] -translate-x-1/2"}`}>
          <JarvisOrb size={62} />
        </button>
      </nav>

      {viewed && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas animate-rise">
          <div className="mx-auto max-w-xl pb-12">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-graphite/95 px-3 py-3">
              <button onClick={closeView} className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              <span className="font-display font-semibold">{viewed.code} · Lesson</span>
            </div>
            <Visual l={viewed} />
            <div className="space-y-4 p-4">
              <Author name={`Nexus AI · ${course}`} meta={`${lvl} · ${viewed.tag}`} />
              <h1 className="font-display text-3xl font-bold leading-tight">{viewed.title}</h1>
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
            </div>
          </div>
        </div>
      )}

      {orb && <Jarvis lessons={lessons} course={course} onClose={() => setOrb(false)} onOpen={(id) => { setOrb(false); if (id === "fresher") setTab("fresher"); else setView(id); }} onNote={(n) => setNotes((x) => [n, ...x])} />}

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

type Msg = { from: "ai" | "me"; text: string };

function Jarvis({ lessons, course, onClose, onOpen, onNote }: { lessons: Lesson[]; course: string; onClose: () => void; onOpen: (id: string) => void; onNote: (n: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "ai", text: "Hey, I'm Jarvis. Open a lesson, check your clearance, or draft a letter." }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, thinking]);
  const chips = [`Open ${lessons[0]?.code ?? "lesson"}`, "Show my clearance", "Draft acceptance letter"];

  const reply = (text: string) => {
    const t = text.toLowerCase();
    const post = lessons.find((p) => t.includes(p.code.toLowerCase()) || t.includes(p.tag.toLowerCase()));
    if (post) return { text: `Roger. Opening ${post.code}.`, act: () => onOpen(post.id) };
    if (/clear|fresher|checklist|timetable/.test(t)) return { text: "On it.", act: () => onOpen("fresher") };
    if (/draft|letter|document/.test(t)) return { text: "Done. Sent to your notifications.", act: () => onNote(`📄 Draft ready: "Letter of Acceptance — ${course}".`) };
    return { text: "Roger. Full answers switch on once the AI key is connected — try opening a lesson." };
  };
  const send = (text: string) => {
    if (!text.trim() || thinking) return;
    setMsgs((m) => [...m, { from: "me", text }]); setInput(""); setThinking(true);
    const r = reply(text);
    setTimeout(() => { setMsgs((m) => [...m, { from: "ai", text: r.text }]); setThinking(false); if (r.act) setTimeout(r.act, 600); }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 animate-rise" onClick={onClose}>
      <div className="card-solid flex max-h-[85dvh] w-full max-w-xl flex-col rounded-t-[2rem] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-2 py-2">
          <JarvisOrb size={thinking ? 96 : 84} />
          <p className="flex items-center gap-1 font-display text-lg font-bold">Jarvis <BadgeCheck className="h-4 w-4 fill-primary text-primary-foreground" /></p>
          <p className="text-xs text-muted-foreground">{thinking ? "Thinking…" : "Voice turns on with your Deepgram key"}</p>
          <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="my-3 flex-1 space-y-2 overflow-y-auto">
          {msgs.map((m, i) => <p key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] ${m.from === "ai" ? "bg-secondary" : "ml-auto bg-primary text-primary-foreground"}`}>{m.text}</p>)}
          <div ref={end} />
        </div>
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {chips.map((c) => <button key={c} onClick={() => send(c)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary">{c}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 rounded-2xl border border-border bg-input/40 p-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Jarvis…" className="flex-1 bg-transparent px-2 text-[15px] outline-none" />
          <button type="submit" aria-label="Send" className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}
