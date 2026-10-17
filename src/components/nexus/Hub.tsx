import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Atom, BadgeCheck, Bell, BookOpen, CalendarDays, CheckCircle2, Circle, Cpu, Eye,
  FlaskConical, Home, LogOut, MessageCircle, Pin, Send, Share2, Sigma, WifiOff, X,
} from "lucide-react";
import { CLEARANCE, POSTS, TIMETABLE, courseName, type Level, type Post } from "@/lib/nexus-data";

type Profile = { level: Level; course: string; faculty: string };
const ICONS = { cpu: Cpu, flask: FlaskConical, atom: Atom, sigma: Sigma, book: BookOpen };
const NEWS_ID = "futes-news";

async function sharePost(id: string, title: string) {
  const url = `${window.location.origin}/?post=${id}`;
  const text = `${title} — on FUTES Nexus`;
  try {
    if (navigator.share) { await navigator.share({ title, text, url }); return; }
  } catch (e) { if ((e as Error).name === "AbortError") return; }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast.success("Link copied — paste it in WhatsApp or your class group");
  } catch {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank");
  }
}

function Avatar({ gold }: { gold?: boolean }) {
  return gold ? (
    <img src="/futes-crest.jpg" alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-gold" />
  ) : (
    <div className="grid h-10 w-10 place-items-center rounded-full bg-orb ring-2 ring-primary/60 font-display text-xs font-bold text-primary-foreground">AI</div>
  );
}

function Author({ gold, name, meta }: { gold?: boolean; name: string; meta: string }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar gold={gold} />
      <div className="min-w-0">
        <p className="flex items-center gap-1 truncate text-sm font-semibold">
          {name}
          <BadgeCheck className={`h-4 w-4 shrink-0 ${gold ? "fill-gold text-graphite" : "fill-primary text-primary-foreground"}`} aria-label="Verified" />
        </p>
        <p className="text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

function PostVisual({ post }: { post: Post }) {
  const Icon = ICONS[post.icon];
  return (
    <div className="relative aspect-video overflow-hidden" style={{ background: `radial-gradient(circle at 30% 30%, oklch(0.6 0.2 ${post.hue}), oklch(0.2 0.06 ${post.hue + 20}) 70%)` }}>
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(oklch(1_0_0/12%)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/12%)_1px,transparent_1px)] [background-size:24px_24px]" />
      <Icon className="absolute right-6 top-1/2 h-24 w-24 -translate-y-1/2 text-foreground/80 animate-float" strokeWidth={1.2} />
      <div className="absolute bottom-4 left-4">
        <span className="rounded-md bg-background/60 px-2 py-1 font-mono text-[11px] backdrop-blur">{post.code}</span>
        <p className="mt-2 max-w-[60%] font-display text-lg font-bold leading-tight">{post.tag}</p>
      </div>
    </div>
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
  const course = courseName(profile.course);
  const lvl = profile.level.replace(" Level", "L");

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    try { setDone(JSON.parse(localStorage.getItem("nexus.clearance") || "[]")); } catch { /* ignore */ }
    const id = new URLSearchParams(window.location.search).get("post");
    if (id) setView(id);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const toggle = (i: number) => {
    const next = done.includes(i) ? done.filter((x) => x !== i) : [...done, i];
    setDone(next); localStorage.setItem("nexus.clearance", JSON.stringify(next));
  };
  const viewed = POSTS.find((p) => p.id === view);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src="/futes-crest.jpg" alt="" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display text-sm font-bold tracking-wide">FUTES <span className="text-primary">// NEXUS</span></span>
          </div>
          <div className="flex items-center gap-1">
            <button aria-label="Messages" onClick={() => toast("Messages arrive when the database is connected")} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><MessageCircle className="h-5 w-5" /></button>
            <button aria-label="Notifications" onClick={() => setBell(true)} className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-secondary">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-primary" />
            </button>
            <button aria-label="Sign out" onClick={onExit} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-warning/90 py-1.5 text-xs font-medium text-graphite">
            <WifiOff className="h-3.5 w-3.5" /> You're offline — showing saved posts
          </div>
        )}
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-3 pb-32 pt-[4.5rem]">
        {tab === "feed" ? (
          <>
            <div className="card-soft flex items-center gap-3 rounded-2xl p-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary font-display text-sm font-bold">{course[0]}</div>
              <div className="min-w-0 text-sm"><p className="truncate font-semibold">{course}</p><p className="text-[11px] text-muted-foreground">{profile.level} · {profile.faculty}</p></div>
            </div>

            {/* Pinned news */}
            <article className="card-soft overflow-hidden rounded-2xl border-gold/30 animate-rise">
              <div className="p-4">
                <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-gold"><Pin className="h-3.5 w-3.5" /> Pinned to your feed</div>
                <Author gold name="FUTES News" meta="Official · For freshers" />
                <h2 className="mt-3 font-display text-lg font-bold">TO THE FRESHERS ✅❤️</h2>
                <p className="mt-1 text-sm leading-relaxed text-foreground/85">Welcome to FUTES! Here are the 13 clearance steps every fresher must complete. Tick them off as you go — your progress is saved on this phone.</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(done.length / CLEARANCE.length) * 100}%` }} /></div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{done.length} of {CLEARANCE.length} done</p>
              </div>
              <div className="grid grid-cols-2 border-t border-border text-sm">
                <button onClick={() => setTab("fresher")} className="flex items-center justify-center gap-2 py-3 hover:bg-secondary/60"><Eye className="h-4 w-4" /> View</button>
                <button onClick={() => sharePost(NEWS_ID, "TO THE FRESHERS — FUTES clearance steps")} className="flex items-center justify-center gap-2 border-l border-border py-3 hover:bg-secondary/60"><Share2 className="h-4 w-4" /> Share</button>
              </div>
            </article>

            {POSTS.map((p, i) => (
              <article key={p.id} className="card-soft overflow-hidden rounded-2xl animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="p-4 pb-3">
                  <Author name={`AI · ${course}`} meta={`${i * 12 + 4} mins ago · ${lvl} ${p.code}`} />
                  <h3 className="mt-3 font-display text-base font-bold leading-snug">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-foreground/80">{p.body}</p>
                </div>
                <button onClick={() => setView(p.id)} className="block w-full"><PostVisual post={p} /></button>
                <div className="grid grid-cols-2 text-sm">
                  <button onClick={() => setView(p.id)} className="flex items-center justify-center gap-2 py-3 hover:bg-secondary/60"><Eye className="h-4 w-4" /> View</button>
                  <button onClick={() => sharePost(p.id, p.title)} className="flex items-center justify-center gap-2 border-l border-border py-3 hover:bg-secondary/60"><Share2 className="h-4 w-4" /> Share</button>
                </div>
              </article>
            ))}
            <p className="py-4 text-center text-[11px] text-muted-foreground">Demo lessons · Built by MWW Studio</p>
          </>
        ) : (
          <>
            <section className="card-soft rounded-2xl p-4 animate-rise">
              <Author gold name="FUTES News" meta="Fresher clearance checklist" />
              <div className="mt-4 space-y-1">
                {CLEARANCE.map((c, i) => {
                  const ok = done.includes(i);
                  return (
                    <button key={c} onClick={() => toggle(i)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-secondary/60">
                      {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
                      <span className={ok ? "text-muted-foreground line-through" : ""}>{i + 1}. {c}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="card-soft rounded-2xl p-4">
              <h3 className="flex items-center gap-2 font-display font-bold"><CalendarDays className="h-4 w-4 text-primary" /> Lecture timetable</h3>
              <div className="mt-3 divide-y divide-border">
                {TIMETABLE.map((t) => (
                  <div key={t.day + t.code} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-10 font-mono text-xs text-primary">{t.day}</span>
                    <div className="flex-1"><p className="font-semibold">{t.code}</p><p className="text-[11px] text-muted-foreground">{t.room}</p></div>
                    <span className="text-xs text-muted-foreground">{t.time}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Sample timetable — real one comes with the database.</p>
            </section>
          </>
        )}
      </main>

      {/* Bottom dock */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="relative mx-auto flex h-16 max-w-sm items-center justify-between rounded-3xl border border-border bg-background/80 px-8 backdrop-blur-xl shadow-2xl">
          <button onClick={() => setTab("feed")} className={`flex flex-col items-center gap-0.5 text-[10px] ${tab === "feed" ? "text-primary" : "text-muted-foreground"}`}><Home className="h-5 w-5" /> Feed</button>
          <button onClick={() => setOrb(true)} aria-label="Open Jarvis" className="absolute left-1/2 top-0 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full p-1 bg-background ring-1 ring-border">
            <span className="relative block h-full w-full rounded-full orb-pulse">
              <span className="absolute inset-0 rounded-full bg-orb animate-spin-slow" />
              <span className="absolute inset-[5px] rounded-full bg-[radial-gradient(circle_at_35%_30%,oklch(0.85_0.12_220),oklch(0.45_0.22_262)_60%,oklch(0.2_0.1_265))]" />
            </span>
          </button>
          <button onClick={() => setTab("fresher")} className={`flex flex-col items-center gap-0.5 text-[10px] ${tab === "fresher" ? "text-primary" : "text-muted-foreground"}`}><CalendarDays className="h-5 w-5" /> Fresher</button>
        </div>
      </nav>

      {/* Full post view */}
      {viewed && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas animate-rise">
          <div className="mx-auto max-w-xl pb-10">
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/70 px-3 py-3 backdrop-blur-xl">
              <button onClick={() => { setView(null); history.replaceState(null, "", "/"); }} className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              <span className="font-display text-sm font-semibold">Lesson</span>
            </div>
            <PostVisual post={viewed} />
            <div className="space-y-4 p-5">
              <Author name={`AI · ${course}`} meta={`${lvl} · ${viewed.code} · ${viewed.tag}`} />
              <h1 className="font-display text-2xl font-bold leading-tight">{viewed.title}</h1>
              <p className="text-[15px] leading-7 text-foreground/90">{viewed.body}</p>
              <div className="card-soft rounded-2xl p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Quick revision</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground/85">
                  <li>Read the summary above twice, then close your eyes and recall it.</li>
                  <li>Write one example from your own life or department.</li>
                  <li>Share it with a classmate and explain it in your own words.</li>
                </ul>
              </div>
              <button onClick={() => sharePost(viewed.id, viewed.title)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"><Share2 className="h-4 w-4" /> Share this lesson</button>
            </div>
          </div>
        </div>
      )}

      {orb && <Jarvis course={course} onClose={() => setOrb(false)} onOpen={(id) => { setOrb(false); id === "fresher" ? setTab("fresher") : setView(id); }} onNote={(n) => setNotes((x) => [n, ...x])} />}

      {bell && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 p-4 pt-20 backdrop-blur-sm" onClick={() => setBell(false)}>
          <div className="card-soft w-full max-w-sm rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-display font-bold">Notifications</p>
            <div className="mt-3 space-y-2 text-sm">
              {notes.map((n, i) => <p key={i} className="rounded-xl bg-secondary/60 p-3">{n}</p>)}
              <p className="rounded-xl bg-secondary/60 p-3">📌 FUTES News pinned the fresher clearance steps.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Msg = { from: "ai" | "me"; text: string };

function Jarvis({ course, onClose, onOpen, onNote }: { course: string; onClose: () => void; onOpen: (id: string) => void; onNote: (n: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "ai", text: `Hey! I'm Jarvis. Ask me to open a lesson, show your clearance, or draft a letter.` }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, thinking]);

  const chips = useMemo(() => ["Show my clearance", "Open CSC 101", "Draft acceptance letter"], []);

  const reply = (text: string) => {
    const t = text.toLowerCase();
    const post = POSTS.find((p) => t.includes(p.code.toLowerCase()) || t.includes(p.tag.toLowerCase()));
    if (post) return { text: `Roger. Opening ${post.code}.`, act: () => onOpen(post.id) };
    if (/clear|fresher|checklist|timetable/.test(t)) return { text: "On it. Here's your checklist.", act: () => onOpen("fresher") };
    if (/draft|letter|document/.test(t)) {
      return { text: `Done. I drafted it and sent it to your notifications.`, act: () => onNote(`📄 Draft ready: "Letter of Acceptance — ${course}". Download arrives when the database is connected.`) };
    }
    return { text: "Roger. Smart answers switch on once the AI is connected — for now try opening a lesson or your clearance." };
  };

  const send = (text: string) => {
    if (!text.trim() || thinking) return;
    setMsgs((m) => [...m, { from: "me", text }]); setInput(""); setThinking(true);
    const r = reply(text);
    setTimeout(() => { setMsgs((m) => [...m, { from: "ai", text: r.text }]); setThinking(false); if (r.act) setTimeout(r.act, 700); }, 650);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/50 backdrop-blur-md animate-rise" onClick={onClose}>
      <div className="card-soft flex max-h-[80dvh] w-full max-w-xl flex-col rounded-t-3xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative h-10 w-10 rounded-full orb-pulse"><span className="absolute inset-0 rounded-full bg-orb animate-spin-slow" /></span>
            <div><p className="flex items-center gap-1 font-display font-bold">Jarvis <BadgeCheck className="h-4 w-4 fill-primary text-primary-foreground" /></p><p className="text-[11px] text-muted-foreground">Voice coming soon · type for now</p></div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="my-4 flex-1 space-y-2 overflow-y-auto">
          {msgs.map((m, i) => (
            <p key={i} className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${m.from === "ai" ? "bg-secondary" : "ml-auto bg-primary text-primary-foreground"}`}>{m.text}</p>
          ))}
          {thinking && <div className="flex h-8 items-center gap-1 px-3">{[0, 1, 2, 3].map((i) => <span key={i} className="h-5 w-1 origin-center rounded bg-primary" style={{ animation: `wave 0.8s ${i * 0.12}s ease-in-out infinite` }} />)}</div>}
          <div ref={end} />
        </div>
        <div className="mb-2 flex gap-2 overflow-x-auto">
          {chips.map((c) => <button key={c} onClick={() => send(c)} className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary">{c}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 rounded-2xl border border-border bg-input/40 p-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Jarvis…" className="flex-1 bg-transparent px-2 text-sm outline-none" />
          <button type="submit" aria-label="Send" className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}
