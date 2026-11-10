import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Atom, BadgeCheck, Bell, BookOpen, Brain, Building2, CheckCircle2, ChevronDown, Cog, Copy, Cpu, Dna, Download, Eye,
  FlaskConical, GraduationCap, Headphones, Home, Library, Lightbulb, Loader2, LogOut, Mic, Pause, Pin, Send, Share2, ShieldAlert, Sigma, Sparkles, WifiOff, X,
} from "lucide-react";
import { COURSES, LEVELS, TIMETABLE, courseName, type Level } from "@/lib/nexus-data";
import { groupOf, lessonsFor, type Icon, type Lesson } from "@/lib/lessons";
import { askJarvis, generatePost, getShared, listShared, makeQuiz, speak, speechText, transcribe, type QuizQ, type SharedPost } from "@/lib/ai.functions";
import { SESSION_BATCH, loadPosts, mergePosts, nextTopic, postedToday, remainingToday, savePosts, spendOne, toStored, type StoredPost } from "@/lib/feed-engine";
import { kittenReady, speakOffline, stopKitten, warmKitten } from "@/lib/offline-voice";

export type Profile = { level: Level; course: string; faculty: string };
const ICONS: Record<Icon, typeof Cpu> = { cpu: Cpu, flask: FlaskConical, atom: Atom, sigma: Sigma, book: BookOpen, cog: Cog, building: Building2, dna: Dna };
const NEWS_ID = "futes-news";
const NEWS = {
  title: "To the freshers: what to bring for registration",
  short: "Welcome to FUTES Iyin-Ekiti. Starting physical registration for 2026/2027? Here is what students are usually asked to bring.",
  full: [
    "Congratulations on your admission into the Federal University of Technology and Environmental Sciences, Iyin-Ekiti.",
    "For the 2026/2027 session, confirm dates on the official FUTES portal and notice boards. Students are usually asked to come with the originals and photocopies of: JAMB admission letter, JAMB result slip, O'Level result(s), birth certificate or age declaration, local government identification letter, passport photographs, acceptance fee and school fee receipts, and your printed online registration forms.",
    "Arrange your documents in a file before coming to your department. Follow official FUTES channels only for payments — never pay anyone privately.",
    "Welcome to the FUTES family. Read hard, stay safe, and enjoy the journey.",
  ],
};

/** One shared player. Server voice (Deepgram Aura-2 → Deepgram backup → Microsoft) online; KittenTTS on-device offline. */
let player: HTMLAudioElement | null = null;
let node: AudioBufferSourceNode | null = null;
let ac: AudioContext | null = null;
let unlocked = false;

/** Call synchronously inside a user tap: unlocks programmatic audio on mobile browsers, so the voice still plays after the server reply arrives. */
export function unlockVoice() {
  try {
    ac ??= new AudioContext();
    void ac.resume();
    const s = ac.createBufferSource();
    s.buffer = ac.createBuffer(1, 1, 22050);
    s.connect(ac.destination);
    s.start(0);
    unlocked = true;
  } catch { unlocked = false; }
}

let voiceToken = 0;
async function playVoice(text: string, onEnd?: () => void): Promise<boolean> {
  stopVoice();
  const my = ++voiceToken;
  if (!navigator.onLine) return speakOffline(text, onEnd, ac);
  try {
    const { audio, mime } = await speak({ data: { text } });
    if (my !== voiceToken) return true;
    if (audio) {
      if (unlocked && ac) {
        const bin = atob(audio);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const buf = await ac.decodeAudioData(bytes.buffer as ArrayBuffer);
        const n = ac.createBufferSource();
        n.buffer = buf;
        n.connect(ac.destination);
        n.onended = () => onEnd?.();
        n.start();
        node = n;
        return true;
      }
      const a = new Audio(`data:${mime};base64,${audio}`);
      player = a;
      a.onended = () => onEnd?.();
      await a.play();
      return true;
    }
  } catch { /* online voice failed */ }
  return my === voiceToken && kittenReady() ? speakOffline(text, onEnd, ac) : false;
}
const stopVoice = () => { voiceToken++; try { node?.stop(); } catch { /* already stopped */ } node = null; player?.pause(); player = null; stopKitten(); };

async function sharePost(id: string, title: string) {
  const url = `${window.location.origin}/?post=${id}`;
  const text = `${title} — on FUTES Nexus`;
  try { if (navigator.share) { await navigator.share({ title, text, url }); return; } }
  catch (e) { if ((e as Error).name === "AbortError") return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast.success("Link copied — paste it in your class group"); }
  catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank"); }
}

function Avatar({ gold, faculty, size = 32 }: { gold?: boolean | undefined; faculty?: string | undefined; size?: number }) {
  const src = gold ? "/futes-crest.jpg" : `/ai/${faculty ? groupOf(faculty) : "general"}.jpg`;
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size }} className={`shrink-0 rounded-full object-cover ring-2 ${gold ? "ring-gold" : "ring-primary/70"}`} />;
}

const HUES = [205, 258, 300, 340, 20, 55, 95, 150, 185];
/** Course name with every letter in a different colour (AI profile identity). */
function CourseName({ name }: { name: string }) {
  return <>{[...name].map((ch, i) => <span key={i} style={{ color: ch === " " ? undefined : `oklch(0.78 0.16 ${HUES[i % HUES.length]})` }}>{ch}</span>)}</>;
}
function timeAgo(at: number) {
  const m = Math.max(1, Math.round((Date.now() - at) / 60000));
  return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`;
}

function Author({ gold, faculty, name, meta }: { gold?: boolean | undefined; faculty?: string | undefined; name: ReactNode; meta: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar gold={gold} faculty={faculty} size={32} />
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[14px] font-semibold leading-tight">
          <span className="truncate">{name}</span>
          <BadgeCheck className={`h-3.5 w-3.5 shrink-0 ${gold ? "fill-gold text-graphite" : "fill-primary text-primary-foreground"}`} aria-label="Verified" />
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

const fromShared = (r: SharedPost): StoredPost => toStored(r.payload, { code: r.code, courseTitle: r.payload.courseTitle ?? r.code, topic: r.topic }, r.id, Date.parse(r.created_at) || Date.now());

function Visual({ l, hideTitle }: { l: Lesson; hideTitle?: boolean }) {
  const I = ICONS[l.icon];
  return (
    <div className="relative h-28 sm:h-36 w-full overflow-hidden rounded-2xl" style={{ background: `radial-gradient(circle at 75% 20%, oklch(0.62 0.2 ${l.hue}), oklch(0.22 0.07 ${l.hue + 25}) 72%)` }}>
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(oklch(1_0_0/14%)_1px,transparent_1px),linear-gradient(90deg,oklch(1_0_0/14%)_1px,transparent_1px)] [background-size:20px_20px]" />
      <I className="absolute -right-3 -top-3 h-28 w-28 text-foreground/15" strokeWidth={1} />
      <div className="absolute inset-x-3.5 top-2.5 flex items-center justify-between">
        <span className="rounded-full bg-background/70 px-2.5 py-0.5 font-mono text-[11px] font-semibold">{l.code}</span>
        <span className="text-[11px] font-medium text-foreground/80">{l.tag}</span>
      </div>
      <div className="absolute inset-x-3.5 bottom-2.5">
        {!hideTitle && <p className="truncate font-display text-[15px] font-bold leading-tight sm:text-base">{l.title}</p>}
        <div className="mt-1 flex items-center gap-1.5 rounded-xl bg-background/70 px-2.5 py-1 text-xs">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-gold" />
          <span className="truncate leading-tight">{l.trick}</span>
        </div>
      </div>
    </div>
  );
}

function Actions({ playing, loading, onListen, onView, onShare, viewLabel = "Read" }: { playing: boolean; loading?: boolean; onListen: () => void; onView: () => void; onShare: () => void; viewLabel?: string }) {
  const b = "flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs sm:text-sm font-semibold transition-colors active:scale-[0.97]";
  return (
    <div className="grid grid-cols-3 gap-1.5 p-2 sm:gap-2 sm:p-2.5">
      <button onClick={onListen} className={`${b} ${playing || loading ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"}`}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : playing ? <Pause className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />} {loading ? "Loading…" : playing ? "Stop" : "Listen"}
      </button>
      <button onClick={onView} className={`${b} bg-primary/15 text-primary hover:bg-primary/25`}><Eye className="h-3.5 w-3.5" /> {viewLabel}</button>
      <button onClick={onShare} className={`${b} bg-secondary hover:bg-secondary/70`}><Share2 className="h-3.5 w-3.5" /> Share</button>
    </div>
  );
}

function NexusOrb({ size }: { size: number }) {
  return (
    <span className="jarvis block" style={{ width: size, height: size }}>
      <span className="jarvis-ring" style={{ inset: 3 }} />
      <span className="jarvis-ring-rev" style={{ inset: size * 0.17 }} />
      <span className="jarvis-core" />
    </span>
  );
}

const FENCE = /```([a-z0-9_-]*)\n([\s\S]*?)```/gi;

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-primary/25 bg-graphite/90 shadow-md">
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/40 px-3 py-1.5 text-[11px]">
        <span className="font-mono font-semibold uppercase tracking-wider text-muted-foreground">{lang || "code"}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-foreground/80 hover:bg-secondary">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-foreground/95">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function RichText({ text, fresh }: { text: string; fresh?: boolean }) {
  const out: ReactNode[] = [];
  let last = 0, k = 0;
  let m: RegExpExecArray | null;
  const prose = (t: string) => (
    <p className="whitespace-pre-wrap">
      {fresh
        ? t.split(/(\s+)/).map((w, j) => (/^\s+$/.test(w) ? w : <span key={j} className="word-up" style={{ animationDelay: `${Math.min(j * 20, 2000)}ms` }}>{w}</span>))
        : t}
    </p>
  );
  FENCE.lastIndex = 0;
  while ((m = FENCE.exec(text))) {
    if (m.index > last) out.push(<div key={k++} className="text-[14px] leading-relaxed text-foreground/95">{prose(text.slice(last, m.index))}</div>);
    out.push(<CodeBlock key={k++} lang={m[1] ?? ""} code={m[2]!.replace(/\n+$/, "")} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(<div key={k++} className="text-[14px] leading-relaxed text-foreground/95">{prose(text.slice(last))}</div>);
  return <>{out}</>;
}

export function Hub({ profile, onSwitch, onExit }: { profile: Profile; onSwitch: (p: Profile) => void; onExit: () => void }) {
  const [tab, setTab] = useState<"feed" | "vault">("feed");
  const [view, setView] = useState<string | null>(null);
  const [news, setNews] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const [orb, setOrb] = useState(false);
  const [online, setOnline] = useState(true);
  const [notes, setNotes] = useState<string[]>([]);
  const [bell, setBell] = useState(false);
  const [quiz, setQuiz] = useState<Lesson | null>(null);
  const [extra, setExtra] = useState<StoredPost | null>(null);
  const [hidden, setHidden] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [aiPosts, setAiPosts] = useState<StoredPost[]>([]);
  const [writing, setWriting] = useState(false);
  const [voiceOffline, setVoiceOffline] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const course = courseName(profile.course);
  const lvl = profile.level.replace(" Level", "L");
  const lessons = useMemo(() => lessonsFor(profile.level, profile.faculty), [profile.level, profile.faculty]);
  const all = useMemo<Lesson[]>(() => {
    const keys = new Set(aiPosts.map((p) => `${p.code}:${p.title}`));
    return [...aiPosts, ...lessons.filter((l) => !keys.has(`${l.code}:${l.title}`))];
  }, [aiPosts, lessons]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setVoiceOffline(kittenReady());
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    const id = new URLSearchParams(window.location.search).get("post");
    if (id === NEWS_ID) setNews(true);
    else if (id) {
      setView(id);
      if (id.startsWith("ai-") && navigator.onLine) void getShared({ data: { id } }).then((r) => { if (r.post) setExtra(fromShared(r.post)); }).catch(() => {});
    }
    if (navigator.onLine && !kittenReady() && window.matchMedia("(display-mode: standalone)").matches) {
      const t = setTimeout(() => { void warmKitten().then(setVoiceOffline); }, 6000);
      window.addEventListener("beforeunload", () => clearTimeout(t));
    }
    const sc = scroller.current;
    let last = sc?.scrollTop ?? 0, ticking = false;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = sc?.scrollTop ?? 0;
        if (Math.abs(y - last) > 10) { setHidden(y > last && y > 120); last = y; }
        ticking = false;
      });
    };
    sc?.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); sc?.removeEventListener("scroll", onScroll); stopVoice(); };
  }, []);

  const writeMore = async (count: number) => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true; setWriting(true);
    try {
      for (let i = 0; i < count && remainingToday() > 0; i++) {
        const saved = loadPosts(profile.level, profile.course);
        if (postedToday(new Date(), saved)) break;
        const t = nextTopic(profile.level, profile.course, profile.faculty, new Set(saved.map((p) => `${p.code}:${p.tag}`)));
        if (!t) break;
        const r = await generatePost({ data: { level: profile.level, course, code: t.code, courseTitle: t.courseTitle, topic: t.topic } }).catch(() => ({ post: null }));
        if (!r.post) break;
        spendOne();
        const next = mergePosts([toStored(r.post, t, r.id ?? undefined)], saved);
        savePosts(profile.level, profile.course, next);
        setAiPosts(next);
        if (i < count - 1) await new Promise((res) => setTimeout(res, 2000));
      }
    } finally { busy.current = false; setWriting(false); }
  };

  useEffect(() => {
    let alive = true;
    const saved = loadPosts(profile.level, profile.course);
    setAiPosts(saved);
    void (async () => {
      let merged = saved;
      if (navigator.onLine) {
        const r = await listShared({ data: { level: profile.level, course } }).catch(() => ({ posts: [] as SharedPost[] }));
        if (!alive) return;
        merged = mergePosts(r.posts.map(fromShared), saved);
        savePosts(profile.level, profile.course, merged);
        setAiPosts(merged);
      }
      if (!postedToday(new Date(), merged)) void writeMore(1);
    })();
    return () => { alive = false; };
  }, [profile.level, profile.course]);

  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (!e[0]?.isIntersecting) return;
      void writeMore(1);
    }, { rootMargin: "600px" });
    io.observe(el); return () => io.disconnect();
  }, [tab, profile.course, profile.level]);

  const overlay = !!view || news || orb || switcher || bell || !!quiz;
  useEffect(() => { document.body.style.overflow = overlay ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [overlay]);

  const listen = async (l: Lesson) => {
    if (playing === l.id || loadingVoice === l.id) { stopVoice(); setPlaying(null); setLoadingVoice(null); return; }
    unlockVoice();
    setLoadingVoice(l.id); setPlaying(null);
    if (!navigator.onLine && !kittenReady()) toast("Preparing offline voice — first time takes a moment.");
    try {
      const say = (l as Partial<StoredPost>).say;
      const text = say || `${l.title}. ${l.body.split(/\n+/)[0]} Remember it like this: ${l.trick}`;
      let ended = false;
      const ok = await playVoice(text, () => { ended = true; setPlaying(null); });
      setLoadingVoice(null);
      if (!ok) { setPlaying(null); toast("Voice is unavailable right now — try again shortly."); }
      else if (!ended) setPlaying(l.id);
    } catch { setLoadingVoice(null); setPlaying(null); toast.error("Couldn't play audio — check your connection."); }
  };

  const viewed = (all.find((p) => p.id === view) ?? (extra?.id === view ? extra : undefined)) as (Lesson & Partial<StoredPost>) | undefined;
  const closeView = () => { setView(null); setExtra(null); history.replaceState(null, "", "/"); };

  const go = (t: "feed" | "vault") => {
    setTab(t);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-canvas">
      {/* Sleek mobile header */}
      <header className="nexus-header relative z-40 h-14 shrink-0 border-b border-border/50">
        <div className="mx-auto flex h-full max-w-xl items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src="/futes-crest.jpg" alt="FUTES" width={36} height={36} className="h-9 w-9 shrink-0 rounded-xl object-cover ring-2 ring-primary/40" />
            <div className="min-w-0 leading-none">
              <p className="whitespace-nowrap font-display text-[16px] font-extrabold tracking-[0.12em]"><span className="text-foreground">FUTES</span> <span className="brand-gradient">NEXUS</span></p>
              <button onClick={() => setSwitcher(true)} className="mt-0.5 flex max-w-full items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${online ? "bg-emerald" : "bg-warning"}`} />
                <span className="truncate">{lvl} · {course}</span>
                <ChevronDown className="h-2.5 w-2.5 shrink-0" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setBell(true)} aria-label="Notifications" className="relative grid h-8 w-8 place-items-center rounded-full hover:bg-secondary">
              <Bell className="h-4 w-4" />
              {notes.length > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary" />}
            </button>
            <button onClick={onExit} aria-label="Exit" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        {!online && <div className="absolute inset-x-0 top-full flex items-center justify-center gap-2 bg-warning py-1 text-[11px] font-medium text-graphite"><WifiOff className="h-3 w-3" /> You're offline — showing saved posts</div>}
      </header>

      <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto max-w-xl space-y-3 px-3 pb-32 pt-3">
        {tab === "feed" ? (
          <>
            <article className="card-solid gold-ring overflow-hidden rounded-2xl">
              <div className="p-3.5">
                <div className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-gold"><Pin className="h-3 w-3" /> Pinned · Student guide</div>
                <Author gold name="Nexus News" meta="Student guide · 2026/2027" />
                <h2 className="mt-2.5 font-display text-base font-bold sm:text-lg">{NEWS.title}</h2>
                <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-foreground/90">{NEWS.short}</p>
              </div>
              <img src="/futes-crest.jpg" alt="FUTES crest" loading="lazy" className="aspect-[21/9] w-full object-cover" />
              <div className="grid grid-cols-2 gap-2 p-2.5">
                <button onClick={() => setNews(true)} className="flex items-center justify-center gap-1.5 rounded-xl bg-gold py-2 text-xs font-semibold text-graphite"><Eye className="h-3.5 w-3.5" /> Read guide</button>
                <button onClick={() => sharePost(NEWS_ID, NEWS.title)} className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary py-2 text-xs font-semibold"><Share2 className="h-3.5 w-3.5" /> Share</button>
              </div>
            </article>

            {writing && (
              <div className="card-solid flex items-center gap-2.5 rounded-2xl p-3">
                <Avatar faculty={profile.faculty} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold"><CourseName name={course} /> AI</p>
                  <p className="busy-glow flex items-center gap-1 text-[11px] text-primary"><Sparkles className="h-3 w-3" /> Writing a new lesson from your scheme of work…</p>
                </div>
              </div>
            )}

            {all.map((l, n) => {
              const ai = l as Lesson & Partial<StoredPost>;
              return (
                <article key={l.id} className="feed-card card-solid overflow-hidden rounded-2xl">
                  <div className="p-3.5 pb-2.5">
                    <Author faculty={profile.faculty} name={<><CourseName name={course} /> AI</>} meta={`${ai.at ? timeAgo(ai.at) : `${n * 7 + 3}m`} · ${lvl} · ${l.code}`} />
                    <h3 className="mt-2.5 font-display text-base font-bold leading-snug sm:text-lg">{l.title}</h3>
                    {ai.hook && <p className="mt-1 text-[14px] font-medium text-primary">{ai.hook}</p>}
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-[14px] leading-relaxed text-foreground/90">{l.body}</p>
                    <button onClick={() => setView(l.id)} className="mt-1 text-xs font-semibold text-primary hover:underline">Read full lesson →</button>
                  </div>
                  <div className="px-3 pb-1">
                    <button onClick={() => setView(l.id)} className="block w-full text-left" aria-label={`View ${l.title}`}><Visual l={l} /></button>
                  </div>
                  <Actions playing={playing === l.id} loading={loadingVoice === l.id} onListen={() => listen(l)} onView={() => setView(l.id)} onShare={() => sharePost(l.id, l.title)} />
                </article>
              );
            })}
            {online && remainingToday() === 0 ? (
              <div ref={sentinel} className="caught-up rounded-2xl p-[2px]">
                <div className="rounded-[calc(1rem-2px)] bg-graphite px-4 py-5 text-center">
                  <Sparkles className="mx-auto h-7 w-7 text-gold" />
                  <p className="text-shimmer mt-2 font-display text-lg font-extrabold sm:text-xl">You're all caught up for today</p>
                  <p className="mt-1 text-[13px] text-foreground/85">Come back tomorrow for your next {course} lesson.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => all[0] && setView(all[0].id)} className="rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground">Revise lesson</button>
                    <button onClick={() => go("vault")} className="rounded-xl bg-secondary py-2 text-xs font-semibold">Study Vault</button>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={sentinel} className="py-4 text-center text-xs text-muted-foreground">{online ? `Loading more for ${lvl} ${course}…` : "Saved on phone · offline mode"}</div>
            )}
          </>
        ) : (
          <>
          <button disabled={voiceOffline} onClick={async () => { toast("Downloading offline voice (~25 MB)…"); const ok = await warmKitten(); setVoiceOffline(ok); toast[ok ? "success" : "error"](ok ? "Offline voice ready — Listen works without internet." : "Download failed — try again on better network."); }}
            className="card-solid flex w-full items-center gap-2.5 rounded-2xl p-3 text-left disabled:opacity-80">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">{voiceOffline ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}</span>
            <span className="min-w-0"><span className="block text-xs font-semibold">{voiceOffline ? "Offline voice is ready" : "Download offline voice"}</span><span className="block text-[11px] text-muted-foreground">Kitten neural voice reads lessons with no internet.</span></span>
          </button>
          <Vault lessons={all} course={course} lvl={lvl} faculty={profile.faculty} onOpen={setView} onAsk={() => { unlockVoice(); setOrb(true); }} />
          </>
        )}
        </div>
      </main>

      {/* Compact bottom dock */}
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),10px)]">
        <div className="relative h-[58px] w-full max-w-[290px]">
          <div className={`dock-glass pointer-events-auto absolute inset-0 grid grid-cols-3 items-center rounded-full transition-[transform,opacity] duration-300 ease-out will-change-transform ${hidden ? "translate-y-[130%] opacity-0" : ""}`}>
            <button onClick={() => go("feed")} className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${tab === "feed" ? "text-primary" : "text-muted-foreground"}`}><Home className="h-4 w-4" /> Feed</button>
            <span />
            <button onClick={() => go("vault")} className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${tab === "vault" ? "text-primary" : "text-muted-foreground"}`}><Library className="h-4 w-4" /> Study Vault</button>
          </div>
          <button
            onClick={() => { unlockVoice(); setOrb(true); }}
            aria-label="Ask Nexus AI"
            className="pointer-events-auto absolute left-1/2 -top-3.5 grid h-[52px] w-[52px] -translate-x-1/2 place-items-center rounded-full bg-graphite shadow-2xl transition-transform active:scale-95"
          >
            <NexusOrb size={48} />
          </button>
        </div>
      </nav>

      {/* Reader Modal */}
      {viewed && (
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas animate-fade">
          <div className="shrink-0 border-b border-border bg-graphite">
            <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2.5">
              <button onClick={closeView} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
              <span className="font-display text-sm font-semibold">{viewed.code} · Lesson</span>
            </div>
          </div>
          <div className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-y-auto overscroll-contain pb-10">
            <div className="p-3 pb-0">
              <Visual l={viewed} hideTitle />
            </div>
            <div className="space-y-3 p-3.5">
              <Author faculty={profile.faculty} name={<><CourseName name={course} /> AI</>} meta={`${lvl} · ${viewed.courseTitle ?? viewed.tag}`} />
              <h1 className="font-display text-xl font-bold leading-tight sm:text-2xl">{viewed.title}</h1>
              {viewed.hook && <p className="text-[15px] font-medium text-primary">{viewed.hook}</p>}
              <div className="space-y-2.5">
                {viewed.body.split(/\n+/).map((p, idx) => <p key={idx} className="text-[14px] sm:text-[15px] leading-relaxed text-foreground/90">{p}</p>)}
              </div>
              <Actions playing={playing === viewed.id} loading={loadingVoice === viewed.id} onListen={() => listen(viewed)} viewLabel="Quiz" onView={() => setQuiz(viewed)} onShare={() => sharePost(viewed.id, viewed.title)} />
              {!!viewed.steps?.length && (
                <div className="card-solid rounded-2xl p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary"><GraduationCap className="h-4 w-4" /> Step by step</p>
                  <ol className="mt-2.5 space-y-2">
                    {viewed.steps.map((s, i) => <li key={s} className="flex gap-2.5 text-[14px] leading-normal"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i + 1}</span><span className="flex-1">{s}</span></li>)}
                  </ol>
                </div>
              )}
              {viewed.example && (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary"><Lightbulb className="h-4 w-4" /> Real-life example</p>
                  <p className="mt-1.5 text-[14px] leading-normal">{viewed.example}</p>
                </div>
              )}
              <div id="trick" className="rounded-2xl border border-gold/30 bg-gold/10 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gold"><Brain className="h-4 w-4" /> Memory trick</p>
                <p className="mt-1.5 font-display text-base font-bold leading-snug">{viewed.trick}</p>
              </div>
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-destructive"><ShieldAlert className="h-4 w-4" /> Exam trap</p>
                <p className="mt-1.5 text-[13px] leading-normal">{viewed.trap}</p>
              </div>
              <div className="card-solid rounded-2xl p-3.5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Lock it in</p>
                <ul className="mt-2 space-y-2">
                  {viewed.points.map((p) => <li key={p} className="flex items-center gap-2 text-[13px]"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> {p}</li>)}
                </ul>
              </div>
              <button onClick={() => setQuiz(viewed)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 py-2.5 text-xs font-semibold text-gold"><Brain className="h-4 w-4" /> Test yourself — practice quiz</button>
              <button onClick={() => { closeView(); unlockVoice(); setOrb(true); }} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground"><Mic className="h-4 w-4" /> Still confused? Ask Nexus</button>
            </div>
          </div>
        </div>
      )}

      {/* News Modal */}
      {news && (
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas animate-fade">
          <div className="shrink-0 border-b border-border bg-graphite">
            <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2.5">
              <button onClick={() => { setNews(false); history.replaceState(null, "", "/"); }} className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
              <span className="font-display text-sm font-semibold">Nexus News</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-xl space-y-3 p-3.5 pb-10">
              <Author gold name="Nexus News" meta="Student guide · 2026/2027" />
              <h1 className="font-display text-xl font-bold leading-tight sm:text-2xl">{NEWS.title}</h1>
              <img src="/futes-crest.jpg" alt="FUTES crest" className="aspect-[21/9] w-full rounded-2xl object-cover" />
              {NEWS.full.map((p, idx) => <p key={idx} className="text-[14px] leading-relaxed text-foreground/90">{p}</p>)}
              <button onClick={() => sharePost(NEWS_ID, NEWS.title)} className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gold py-2.5 text-xs font-semibold text-graphite"><Share2 className="h-3.5 w-3.5" /> Share with coursemates</button>
            </div>
          </div>
        </div>
      )}

      {/* Course Switcher */}
      {switcher && <CourseSwitcher current={profile} onSelect={(p) => { onSwitch(p); setSwitcher(false); }} onClose={() => setSwitcher(false)} />}

      {/* Nexus AI Chat Modal */}
      {orb && <NexusModal profile={profile} onClose={() => { stopVoice(); setOrb(false); }}
        onOpen={(id) => { setOrb(false); if (id === "news") setNews(true); else if (id === "vault") go("vault"); else setView(id); }}
        onNote={(n) => setNotes((x) => [n, ...x])} />}

      {/* Notifications */}
      {bell && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 p-3 pt-16" onClick={() => setBell(false)}>
          <div className="card-solid w-full max-w-sm rounded-2xl p-3.5" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-base font-bold">Notifications</p>
            <div className="mt-2.5 space-y-2 text-xs">
              {notes.map((n, i) => <p key={i} className="rounded-xl bg-secondary/60 p-2.5">{n}</p>)}
              <p className="rounded-xl bg-secondary/60 p-2.5">Nexus News pinned the 2026/2027 registration guide.</p>
            </div>
          </div>
        </div>
      )}

      {quiz && <Quiz lesson={quiz} level={profile.level} onClose={() => setQuiz(null)} />}
    </div>
  );
}

function CourseSwitcher({ current, onSelect, onClose }: { current: Profile; onSelect: (p: Profile) => void; onClose: () => void }) {
  const [level, setLevel] = useState<Level>(current.level);
  const [course, setCourse] = useState(current.course);
  const [q, setQ] = useState("");
  const list = COURSES.filter((c) => courseName(c.name).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 sm:items-center" onClick={onClose}>
      <div className="card-solid flex max-h-[82dvh] w-full max-w-md flex-col rounded-t-2xl p-3.5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-display text-base font-bold">Switch level & course</p>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={`rounded-xl py-2 text-xs font-semibold ${level === l ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{l}</button>
          ))}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 35 courses…" className="mt-2.5 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary" />
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto divide-y divide-border/60">
          {list.map((c) => (
            <button key={c.name} onClick={() => setCourse(c.name)} className={`flex w-full items-center justify-between py-2 text-left text-xs ${course === c.name ? "font-bold text-primary" : "text-foreground/90"}`}>
              <span className="truncate pr-2">{courseName(c.name)}</span>
              {course === c.name && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
        <button
          onClick={() => { const f = COURSES.find((c) => c.name === course)?.faculty ?? current.faculty; onSelect({ level, course, faculty: f }); }}
          className="mt-3 w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground"
        >
          Switch now
        </button>
      </div>
    </div>
  );
}

function Vault({ lessons, course, lvl, faculty, onOpen, onAsk }: { lessons: Lesson[]; course: string; lvl: string; faculty: string; onOpen: (id: string) => void; onAsk: () => void }) {
  const [flip, setFlip] = useState<string | null>(null);
  return (
    <>
      <section className="card-solid relative overflow-hidden rounded-2xl p-4 animate-fade">
        <div className="flex items-center gap-3">
          <Avatar faculty={faculty} size={44} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Study Vault</p>
            <p className="text-shimmer mt-0.5 truncate font-display text-base font-bold">{course}</p>
            <p className="text-[11px] text-muted-foreground">{lvl} scheme of work · {lessons.length} topics</p>
          </div>
        </div>
        <button onClick={onAsk} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground"><Mic className="h-3.5 w-3.5" /> Ask your course tutor</button>
      </section>

      <section className="card-solid rounded-2xl p-3.5">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold"><GraduationCap className="h-4 w-4 text-primary" /> Scheme of work</h3>
        <div className="mt-2 divide-y divide-border/60">
          {lessons.map((l, i) => (
            <button key={l.id} onClick={() => onOpen(l.id)} className="flex w-full items-center gap-2.5 py-2.5 text-left">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/15 font-mono text-[11px] font-bold text-primary">W{i + 1}</span>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{l.title}</p><p className="text-[10px] text-muted-foreground">{l.code} · {l.tag}</p></div>
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <section className="card-solid rounded-2xl p-3.5">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold"><Brain className="h-4 w-4 text-gold" /> Memory deck</h3>
        <p className="text-[11px] text-muted-foreground">Tap a card to reveal the trick.</p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {lessons.map((l) => (
            <button key={l.id} onClick={() => setFlip(flip === l.id ? null : l.id)} className={`min-h-24 rounded-xl border p-2.5 text-left text-xs transition-colors ${flip === l.id ? "border-gold/40 bg-gold/10" : "border-border bg-secondary/40"}`}>
              <p className="font-mono text-[10px] font-semibold text-primary">{l.code}</p>
              <p className="mt-1 leading-snug">{flip === l.id ? l.trick : l.title}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="card-solid rounded-2xl p-3.5">
        <h3 className="flex items-center gap-1.5 font-display text-base font-bold"><ShieldAlert className="h-4 w-4 text-destructive" /> Exam trap bank</h3>
        <div className="mt-2 space-y-1.5">
          {lessons.map((l) => <div key={l.id} className="rounded-xl bg-destructive/10 p-2.5 text-xs"><p className="font-mono text-[10px] font-semibold text-destructive">{l.code}</p><p className="mt-0.5 leading-normal">{l.trap}</p></div>)}
        </div>
      </section>

      <section className="card-solid rounded-2xl p-3.5">
        <h3 className="font-display text-base font-bold">This week's lectures</h3>
        <div className="mt-2 divide-y divide-border/60">
          {TIMETABLE.map((t) => (
            <div key={t.day + t.code} className="flex items-center gap-2.5 py-2 text-xs">
              <span className="w-8 font-mono text-[11px] font-semibold text-primary">{t.day}</span>
              <div className="flex-1"><p className="font-semibold">{t.code}</p><p className="text-[10px] text-muted-foreground">{t.room}</p></div>
              <span className="text-[10px] text-muted-foreground">{t.time}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function NexusModal({ profile, onClose, onOpen, onNote }: { profile: Profile; onClose: () => void; onOpen: (id: string) => void; onNote: (n: string) => void }) {
  const course = courseName(profile.course);
  const faculty = profile.faculty;
  const storageKey = `nexus-chat-v2:${profile.level}:${profile.course}`;
  const [msgs, setMsgs] = useState<{ from: "me" | "nexus"; text: string; fresh?: boolean }[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [{ from: "nexus", text: `I am your ${profile.level} ${course} tutor. Ask me any question from your syllabus, or tap the mic to speak.`, fresh: false }];
  });
  const [input, setInput] = useState("");
  const [state, setState] = useState<"idle" | "thinking" | "voice" | "speaking">("idle");
  const [voice, setVoice] = useState<"off" | "listening" | "cancel">("off");
  const [vol, setVol] = useState<number[]>([1, 1, 1, 1, 1]);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const voiceRef = useRef<"off" | "listening" | "cancel">("off");
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
    try { localStorage.setItem(storageKey, JSON.stringify(msgs.slice(-20))); } catch {}
  }, [msgs, storageKey]);

  useEffect(() => () => {
    try { rec.current?.stop(); } catch {}
    stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const send = async (txt: string) => {
    const q = txt.trim(); if (!q) return;
    setInput("");
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setState("thinking");
    try {
      const r = await askJarvis({ data: { message: q, level: profile.level, course, faculty } });
      setState("idle");
      if (r.reply) setMsgs((m) => [...m, { from: "nexus", text: r.reply, fresh: true }]);
      if (r.action) {
        if (r.action.type === "open_post") onOpen(r.action.postId);
        else if (r.action.type === "open_news") onOpen("news");
        else if (r.action.type === "open_vault") onOpen("vault");
        else if (r.action.type === "note") onNote(r.action.text);
      }
    } catch { setState("idle"); setMsgs((m) => [...m, { from: "nexus", text: "Connection dropped. Try again." }]); }
  };

  const startHold = async (y: number) => {
    stopVoice(); unlockVoice();
    chunks.current = [];
    voiceRef.current = "listening";
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mr = new MediaRecorder(s, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined });
      rec.current = mr;
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.start(80);
      setVoice("listening");
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(s);
      const an = ctx.createAnalyser();
      an.fftSize = 32; src.connect(an);
      const data = new Uint8Array(an.frequencyBinCount);
      const timer = setInterval(() => {
        if (!rec.current || rec.current.state !== "recording") { clearInterval(timer); void ctx.close(); return; }
        an.getByteFrequencyData(data);
        const bars = [data[1], data[3], data[5], data[7], data[9]].map((v) => Math.max(0.18, (v || 0) / 255));
        setVol(bars);
      }, 70);
    } catch { voiceRef.current = "off"; setVoice("off"); toast.error("Microphone access denied."); }
  };

  const endHold = async () => {
    const cancel = voiceRef.current === "cancel";
    voiceRef.current = "off";
    setVoice("off");
    const mr = rec.current;
    if (mr && mr.state !== "inactive") {
      await new Promise((res) => { mr.onstop = res; mr.stop(); });
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    if (cancel) { toast("Recording cancelled"); return; }
    const mime = mr?.mimeType || "audio/webm";
    const blob = new Blob(chunks.current, { type: mime });
    if (blob.size < 600) return;
    setState("thinking");
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    try {
      const { text } = await transcribe({ data: { base64: btoa(bin), mime } });
      if (text) void send(text);
      else { setState("idle"); toast("Didn't catch that — try again."); }
    } catch { setState("idle"); toast.error("Voice recognition failed."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm animate-fade sm:items-center sm:p-4" onClick={onClose}>
      <div className="card-solid relative flex h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl sm:h-[84dvh] sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {voice !== "off" && (
          <div className="absolute inset-0 z-20 flex animate-fade flex-col items-center justify-between bg-graphite/95 px-5 pb-8 pt-12">
            <p className={`text-center text-xs font-medium ${voice === "cancel" ? "text-destructive" : "text-muted-foreground"}`}>{voice === "cancel" ? "Cancelling…" : "Speak now · tap to send"}</p>
            <div aria-hidden className="flex h-20 items-center gap-[3px]">
              {vol.map((v, i) => (
                <span key={i} className="w-1.5 rounded-full bg-primary transition-all duration-75" style={{ height: `${Math.max(12, v * 70)}px`, opacity: 0.5 + v * 0.5 }} />
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { voiceRef.current = "cancel"; setVoice("cancel"); void endHold(); }} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">Cancel</button>
              <button type="button" onClick={() => void endHold()} className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground">Tap to send</button>
            </div>
          </div>
        )}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3.5">
          <div className="flex items-center gap-2.5">
            <NexusOrb size={32} />
            <div className="min-w-0 leading-tight">
              <p className="flex items-center gap-1 font-display text-sm font-bold">Nexus AI <BadgeCheck className="h-3.5 w-3.5 fill-primary text-primary-foreground" /></p>
              <p className="truncate text-[10px] text-muted-foreground">{profile.level} · {course}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <div className="space-y-3">
            {msgs.map((m, i) => m.from === "me" ? (
              <div key={i} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-3 py-2 text-[13px] leading-relaxed text-primary-foreground">{m.text}</p></div>
            ) : (
              <div key={i} className="flex gap-2">
                <Avatar faculty={faculty} size={28} />
                <div className="min-w-0 flex-1 pt-0.5">
                  <RichText text={m.text} fresh={m.fresh !== false} />
                </div>
              </div>
            ))}
            {state === "thinking" && (
              <div className="flex items-center gap-2 text-xs text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…</div>
            )}
          </div>
          <div ref={end} />
        </div>
        <div className="shrink-0 p-2.5 border-t border-border/60 bg-graphite">
          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-1.5">
            <input
              ref={box as any}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Nexus anything…"
              className="min-h-[38px] flex-1 rounded-xl border border-border bg-secondary/50 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {input.trim() ? (
              <button type="submit" disabled={state === "thinking"} aria-label="Send" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-3.5 w-3.5" /></button>
            ) : (
              <button
                type="button"
                onClick={() => { if (state === "thinking" || voice !== "off") return; void startHold(0); }}
                aria-label="Tap to talk"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary active:scale-95"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function Quiz({ lesson, level, onClose }: { lesson: Lesson; level: Level; onClose: () => void }) {
  const [diff, setDiff] = useState<"easy" | "medium" | "hard" | null>(null);
  const [qs, setQs] = useState<QuizQ[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const start = async (d: "easy" | "medium" | "hard") => {
    setDiff(d); setQs(null); setErr(null); setI(0); setPick(null); setScore(0);
    if (!navigator.onLine) { setErr("You're offline. Quizzes need internet."); return; }
    try {
      const r = await makeQuiz({ data: { title: lesson.title, code: lesson.code, body: `${lesson.body}\nTrick: ${lesson.trick}\nTrap: ${lesson.trap}`, level, difficulty: d } });
      if (r.questions.length) setQs(r.questions);
      else setErr("Couldn't build quiz. Tap to try again.");
    } catch { setErr("Connection dropped. Tap to try again."); }
  };

  const q = qs?.[i];
  const done = qs && i >= qs.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/85 animate-fade sm:items-center sm:p-4" onClick={onClose}>
      <div className="card-solid flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-2xl p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-gold">Quiz · {lesson.code}</p><p className="truncate font-display text-sm font-bold">{lesson.title}</p></div>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["easy", "medium", "hard"] as const).map((d) => <button key={d} onClick={() => void start(d)} className={`rounded-xl py-2 text-xs font-semibold capitalize ${diff === d ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{d}</button>)}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!diff && <p className="text-xs text-muted-foreground">Pick a difficulty level to practice.</p>}
          {diff && !qs && !err && <div className="flex items-center gap-2 py-6 text-xs text-primary"><Loader2 className="h-4 w-4 animate-spin" /> Preparing quiz…</div>}
          {err && <p className="rounded-xl bg-destructive/15 p-3 text-xs text-destructive">{err}</p>}
          {q && (
            <div>
              <p className="text-[11px] text-muted-foreground">Question {i + 1} of {qs.length}</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed">{q.q}</p>
              <div className="mt-2.5 space-y-1.5">
                {q.options.map((o, k) => {
                  const state = pick === null ? "border-border bg-secondary/40" : k === q.answer ? "border-emerald bg-emerald/15 font-semibold text-emerald" : k === pick ? "border-destructive bg-destructive/15 text-destructive" : "opacity-60";
                  return <button key={k} disabled={pick !== null} onClick={() => { setPick(k); if (k === q.answer) setScore((x) => x + 1); }} className={`w-full rounded-xl border p-2.5 text-left text-xs ${state}`}>{o}</button>;
                })}
              </div>
              {pick !== null && (
                <div className="mt-2.5 rounded-xl bg-secondary/50 p-2.5 text-[11px] leading-relaxed">
                  <p className="font-semibold">{pick === q.answer ? "Correct." : "Not quite."}</p>
                  <p className="mt-0.5">{q.why}</p>
                  <button onClick={() => { setI(i + 1); setPick(null); }} className="mt-2.5 w-full rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground">{i + 1 < qs.length ? "Next question" : "See score"}</button>
                </div>
              )}
            </div>
          )}
          {done && (
            <div className="py-4 text-center">
              <Sparkles className="mx-auto h-7 w-7 text-gold" />
              <p className="mt-2 font-display text-base font-bold">{score}/{qs.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">{score === qs.length ? "Full score! Mastered." : "Keep practising."}</p>
              <button onClick={() => diff && void start(diff)} className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">Retry</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
