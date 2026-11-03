import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, Atom, BadgeCheck, Bell, BookOpen, Brain, Building2, CheckCircle2, ChevronDown, Cog, Cpu, Dna, Download, Eye,
  FlaskConical, GraduationCap, Headphones, Home, Library, Lightbulb, Loader2, LogOut, Mic, Pause, Pin, Send, Share2, ShieldAlert, Sigma, Sparkles, Square, WifiOff, X,
} from "lucide-react";
import { COURSES, LEVELS, TIMETABLE, courseName, type Level } from "@/lib/nexus-data";
import { groupOf, lessonsFor, type Icon, type Lesson } from "@/lib/lessons";
import { askJarvis, generatePost, getShared, listShared, makeQuiz, speak, transcribe, type QuizQ, type SharedPost } from "@/lib/ai.functions";
import { SESSION_BATCH, loadPosts, mergePosts, nextTopic, remainingToday, savePosts, spendOne, toStored, type StoredPost } from "@/lib/feed-engine";
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
async function playVoice(text: string, onEnd?: () => void): Promise<boolean> {
  stopVoice();
  if (!navigator.onLine) return speakOffline(text, onEnd);
  try {
    const { audio, mime } = await speak({ data: { text } });
    if (audio) {
      const a = new Audio(`data:${mime};base64,${audio}`);
      player = a;
      a.onended = () => onEnd?.();
      await a.play();
      return true;
    }
  } catch { /* fall through to offline voice */ }
  return speakOffline(text, onEnd);
}
const stopVoice = () => { player?.pause(); player = null; stopKitten(); };

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

const fromShared = (r: SharedPost): StoredPost => toStored(r.payload, { code: r.code, courseTitle: r.payload.courseTitle ?? r.code, topic: r.topic }, r.id, Date.parse(r.created_at) || Date.now());

function Visual({ l, hideTitle }: { l: Lesson; hideTitle?: boolean }) {
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
        {!hideTitle && <p className="font-display text-2xl font-bold leading-tight sm:text-3xl">{l.title}</p>}
        <div className="mt-3 flex items-start gap-2 rounded-2xl bg-background/70 p-3 text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span className="leading-snug">{l.trick}</span>
        </div>
      </div>
    </div>
  );
}

function Actions({ playing, loading, onListen, onView, onShare, viewLabel = "View" }: { playing: boolean; loading?: boolean; onListen: () => void; onView: () => void; onShare: () => void; viewLabel?: string }) {
  const b = "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors active:scale-[0.97]";
  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      <button onClick={onListen} className={`${b} ${playing || loading ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"}`}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : playing ? <Pause className="h-4 w-4" /> : <Headphones className="h-4 w-4" />} {loading ? "Loading…" : playing ? "Stop" : "Listen"}
      </button>
      <button onClick={onView} className={`${b} bg-primary/15 text-primary hover:bg-primary/25`}><Eye className="h-4 w-4" /> {viewLabel}</button>
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
      // Shared link from another course: fetch that one lesson from the shared library.
      if (id.startsWith("ai-") && navigator.onLine) void getShared({ data: { id } }).then((r) => { if (r.post) setExtra(fromShared(r.post)); }).catch(() => {});
    }
    // Installed app: fetch the offline voice quietly once, so it speaks even in airplane mode.
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
        if (Math.abs(y - last) > 10) { setHidden(y > last && y > 140); last = y; }
        ticking = false;
      });
    };
    sc?.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); sc?.removeEventListener("scroll", onScroll); stopVoice(); };
  }, []);

  // AI feed: load saved posts for this course, then write new ones one at a time (gentle on rate limits).
  const writeMore = async (count: number) => {
    if (busy.current || !navigator.onLine) return;
    busy.current = true; setWriting(true);
    try {
      for (let i = 0; i < count && remainingToday() > 0; i++) {
        const saved = loadPosts(profile.level, profile.course);
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
        // Shared library: lessons other students already unlocked — loads on every domain, costs no AI request.
        const r = await listShared({ data: { level: profile.level, course } }).catch(() => ({ posts: [] as SharedPost[] }));
        if (!alive) return;
        merged = mergePosts(r.posts.map(fromShared), saved);
        savePosts(profile.level, profile.course, merged);
        setAiPosts(merged);
      }
      const fresh = merged[0] && Date.now() - merged[0].at < 20 * 60 * 1000;
      if (!fresh || merged.length < 6) void writeMore(SESSION_BATCH);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.level, profile.course]);

  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((e) => {
      if (!e[0]?.isIntersecting) return;
      void writeMore(1);
    }, { rootMargin: "800px" });
    io.observe(el); return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile.course, profile.level]);

  // Lock page scroll under overlays so nothing jumps behind them.
  const overlay = !!view || news || orb || switcher || bell || !!quiz;
  useEffect(() => { document.body.style.overflow = overlay ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [overlay]);

  const listen = async (l: Lesson) => {
    if (playing === l.id || loadingVoice === l.id) { stopVoice(); setPlaying(null); setLoadingVoice(null); return; }
    setLoadingVoice(l.id); setPlaying(null);
    if (!navigator.onLine && !kittenReady()) toast("Preparing offline voice — first time takes a moment.");
    try {
      // Short spoken version = fast audio (about 2 seconds to start) and easy to follow.
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
  const closeView = () => { setView(null); history.replaceState(null, "", "/"); };
  const go = (t: "feed" | "vault") => { setTab(t); scroller.current?.scrollTo({ top: 0 }); setHidden(false); };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-canvas">
      {/* Locked header: lives outside the scroll area, so mobile address-bar collapse can never move it. */}
      <header className="nexus-header relative z-40 h-[72px] shrink-0">
        <div className="mx-auto flex h-full max-w-xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/futes-crest.jpg" alt="FUTES" width={44} height={44} className="h-11 w-11 shrink-0 rounded-2xl object-cover ring-2 ring-primary/40" />
            <div className="min-w-0 leading-none">
              <p className="whitespace-nowrap font-display text-[18px] font-extrabold tracking-[0.14em]"><span className="text-foreground">FUTES</span> <span className="brand-gradient">NEXUS</span></p>
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
        {!online && <div className="absolute inset-x-0 top-full flex items-center justify-center gap-2 bg-warning py-1.5 text-xs font-medium text-graphite"><WifiOff className="h-3.5 w-3.5" /> You're offline — showing saved posts</div>}
      </header>

      <main ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto max-w-xl space-y-4 px-3 pb-40 pt-4">
        {tab === "feed" ? (
          <>
            <article className="card-solid gold-ring overflow-hidden rounded-3xl">
              <div className="p-4">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-gold"><Pin className="h-3.5 w-3.5" /> Pinned · Student guide</div>
                <Author gold name="Nexus News" meta="Student guide · 2026/2027" />
                <h2 className="mt-3 font-display text-xl font-bold">{NEWS.title}</h2>
                <p className="mt-1.5 text-[16px] leading-relaxed text-foreground/90">{NEWS.short}</p>
              </div>
              <img src="/futes-crest.jpg" alt="FUTES crest" loading="lazy" className="aspect-[16/9] w-full object-cover" />
              <div className="grid grid-cols-2 gap-2 p-3">
                <button onClick={() => setNews(true)} className="flex items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-sm font-semibold text-graphite"><Eye className="h-4 w-4" /> View more</button>
                <button onClick={() => sharePost(NEWS_ID, NEWS.title)} className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-2.5 text-sm font-semibold"><Share2 className="h-4 w-4" /> Share</button>
              </div>
            </article>

            {writing && (
              <div className="card-solid flex items-center gap-3 rounded-3xl p-4">
                <Avatar faculty={profile.faculty} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold"><CourseName name={course} /> AI</p>
                  <p className="busy-glow flex items-center gap-1.5 text-xs text-primary"><Sparkles className="h-3.5 w-3.5" /> Writing a new lesson from your scheme of work…</p>
                </div>
              </div>
            )}

            {all.map((l, n) => {
              const ai = l as Lesson & Partial<StoredPost>;
              return (
                <article key={l.id} className="feed-card card-solid overflow-hidden rounded-3xl">
                  <div className="p-4 pb-3">
                    <Author faculty={profile.faculty} name={<><CourseName name={course} /> AI</>} meta={`${ai.at ? timeAgo(ai.at) : `${n * 7 + 3}m`} · ${lvl} · ${l.code}`} />
                    <h3 className="mt-3 font-display text-lg font-bold leading-snug">{l.title}</h3>
                    {ai.hook && <p className="mt-1 text-[15px] font-medium text-primary">{ai.hook}</p>}
                    <p className="mt-2 line-clamp-6 whitespace-pre-line text-[16px] leading-relaxed text-foreground/90">{l.body}</p>
                    <button onClick={() => setView(l.id)} className="mt-1 text-sm font-semibold text-muted-foreground hover:text-foreground">See more</button>
                  </div>
                  <button onClick={() => setView(l.id)} className="block w-full text-left" aria-label={`View ${l.title}`}><Visual l={l} /></button>
                  <Actions playing={playing === l.id} loading={loadingVoice === l.id} onListen={() => listen(l)} onView={() => setView(l.id)} onShare={() => sharePost(l.id, l.title)} />
                </article>
              );
            })}
            {online && remainingToday() === 0 ? (
              <div ref={sentinel} className="caught-up rounded-3xl p-[2px]">
                <div className="rounded-[calc(1.5rem-2px)] bg-graphite px-5 py-7 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-gold" />
                  <p className="text-shimmer mt-3 font-display text-2xl font-extrabold">You're all caught up for today</p>
                  <p className="mt-2 text-[15px] text-foreground/85">Come back tomorrow for 20 fresh {course} lessons from your scheme of work.</p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button onClick={() => all[0] && setView(all[0].id)} className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Revise a lesson</button>
                    <button onClick={() => go("vault")} className="rounded-xl bg-secondary py-2.5 text-sm font-semibold">Study Vault</button>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={sentinel} className="py-6 text-center text-xs text-muted-foreground">{online ? `Loading more for ${lvl} ${course}…` : "You're offline — these lessons are saved on your phone."}</div>
            )}
          </>
        ) : (
          <>
          <button disabled={voiceOffline} onClick={async () => { toast("Downloading offline voice (~25 MB)…"); const ok = await warmKitten(); setVoiceOffline(ok); toast[ok ? "success" : "error"](ok ? "Offline voice ready — Listen works without internet." : "Download failed — try again on better network."); }}
            className="card-solid flex w-full items-center gap-3 rounded-3xl p-4 text-left disabled:opacity-80">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">{voiceOffline ? <CheckCircle2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}</span>
            <span className="min-w-0"><span className="block text-sm font-semibold">{voiceOffline ? "Offline voice is ready" : "Download offline voice"}</span><span className="block text-xs text-muted-foreground">Kitten neural voice reads lessons with no internet.</span></span>
          </button>
          <Vault lessons={all} course={course} lvl={lvl} faculty={profile.faculty} onOpen={setView} onAsk={() => setOrb(true)} />
          </>
        )}
        </div>
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
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas animate-fade">
          <div className="shrink-0 border-b border-border bg-graphite">
            <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-3">
              <button onClick={closeView} className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              <span className="font-display font-semibold">{viewed.code} · Lesson</span>
            </div>
          </div>
          <div className="mx-auto min-h-0 w-full max-w-xl flex-1 overflow-y-auto overscroll-contain pb-12">
            <Visual l={viewed} hideTitle />
            <div className="space-y-4 p-4">
              <Author faculty={profile.faculty} name={<><CourseName name={course} /> AI</>} meta={`${lvl} · ${viewed.courseTitle ?? viewed.tag}`} />
              <h1 className="font-display text-3xl font-bold leading-tight">{viewed.title}</h1>
              {viewed.hook && <p className="text-lg font-medium text-primary">{viewed.hook}</p>}
              {viewed.body.split(/\n+/).map((p) => <p key={p} className="text-[17px] leading-8 text-foreground/90">{p}</p>)}
              <Actions playing={playing === viewed.id} loading={loadingVoice === viewed.id} onListen={() => listen(viewed)} viewLabel="Quiz" onView={() => setQuiz(viewed)} onShare={() => sharePost(viewed.id, viewed.title)} />
              {!!viewed.steps?.length && (
                <div className="card-solid rounded-3xl p-5">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><GraduationCap className="h-4 w-4" /> Step by step</p>
                  <ol className="mt-3 space-y-3">
                    {viewed.steps.map((s, i) => <li key={s} className="flex gap-3 text-[16px] leading-7"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{i + 1}</span>{s}</li>)}
                  </ol>
                </div>
              )}
              {viewed.example && (
                <div className="rounded-3xl border border-primary/30 bg-primary/10 p-5">
                  <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><Lightbulb className="h-4 w-4" /> Real-life example</p>
                  <p className="mt-2 text-[16px] leading-7">{viewed.example}</p>
                </div>
              )}
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
              <button onClick={() => setQuiz(viewed)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/40 bg-gold/10 py-3 font-semibold text-gold"><Brain className="h-4 w-4" /> Test yourself — practice quiz</button>
              <button onClick={() => { closeView(); setOrb(true); }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-semibold text-primary-foreground"><Mic className="h-4 w-4" /> Still confused? Ask Nexus</button>
            </div>
          </div>
        </div>
      )}

      {news && (
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas animate-fade">
          <div className="shrink-0 border-b border-border bg-graphite">
            <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-3">
              <button onClick={() => { setNews(false); history.replaceState(null, "", "/"); }} className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
              <span className="font-display font-semibold">Nexus News</span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto max-w-xl space-y-4 p-4 pb-12">
              <Author gold name="Nexus News" meta="Student guide · 2026/2027" />
              <h1 className="font-display text-3xl font-bold leading-tight">{NEWS.title}</h1>
              <img src="/futes-crest.jpg" alt="FUTES crest" className="aspect-[16/9] w-full rounded-3xl object-cover" />
              {NEWS.full.map((p) => <p key={p} className="text-[17px] leading-8 text-foreground/90">{p}</p>)}
              <button onClick={() => sharePost(NEWS_ID, NEWS.title)} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gold py-3 font-semibold text-graphite"><Share2 className="h-4 w-4" /> Share with your coursemates</button>
            </div>
          </div>
        </div>
      )}

      {quiz && <Quiz lesson={quiz} level={profile.level} onClose={() => setQuiz(null)} />}

      {switcher && <Switcher profile={profile} onClose={() => setSwitcher(false)} onExit={onExit} onSave={(p) => { setSwitcher(false); scroller.current?.scrollTo({ top: 0 }); onSwitch(p); toast.success(`Switched to ${p.level.replace(" Level", "L")} · ${courseName(p.course)}`); }} />}

      {orb && <Nexus lessons={lessons} course={course} level={profile.level} faculty={profile.faculty}
        onClose={() => { stopVoice(); setOrb(false); }}
        onOpen={(id) => { setOrb(false); if (id === "news") setNews(true); else if (id === "vault") go("vault"); else setView(id); }}
        onNote={(n) => setNotes((x) => [n, ...x])} />}

      {bell && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/70 p-4 pt-20" onClick={() => setBell(false)}>
          <div className="card-solid w-full max-w-sm rounded-3xl p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg font-bold">Notifications</p>
            <div className="mt-3 space-y-2 text-sm">
              {notes.map((n, i) => <p key={i} className="rounded-2xl bg-secondary/60 p-3">{n}</p>)}
              <p className="rounded-2xl bg-secondary/60 p-3">Nexus News pinned the 2026/2027 registration guide.</p>
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

type Msg = { from: "ai" | "me"; text: string; fresh?: boolean };

function Nexus({ lessons, course, level, faculty, onClose, onOpen, onNote }: { lessons: Lesson[]; course: string; level: Level; faculty: string; onClose: () => void; onOpen: (id: string) => void; onNote: (n: string) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ from: "ai", text: `I'm Nexus, your ${course} coursemate. Ask me any topic and I'll explain it simply, or tap the mic.` }]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<"idle" | "listening" | "thinking" | "voice" | "speaking">("idle");
  const rec = useRef<MediaRecorder | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; }, [input]);
  const chatKey = `nexus.chat.${course}`;
  useEffect(() => { try { const m = JSON.parse(localStorage.getItem(chatKey) || "null") as Msg[] | null; if (m?.length) setMsgs(m.map((x) => ({ ...x, fresh: false }))); } catch { /* ignore */ } }, [chatKey]);
  useEffect(() => { try { localStorage.setItem(chatKey, JSON.stringify(msgs.slice(-40).map(({ from, text }) => ({ from, text })))); } catch { /* ignore */ } }, [msgs, chatKey]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, state]);
  useEffect(() => () => { rec.current?.state === "recording" && rec.current.stop(); }, []);
  const chips = [`Explain ${lessons[0]?.code ?? "my course"} simply`, "Give me 3 exam questions", "Explain it like I'm 12", "Open Nexus News"];

  // Local intents: 0 API calls, instant.
  const local = (t: string) => {
    const post = lessons.find((p) => t.includes(p.code.toLowerCase()) && /open|show|go/.test(t));
    if (post) return { text: `Roger. Opening ${post.code}.`, act: () => onOpen(post.id) };
    if (/news|fresher|registration/.test(t)) return { text: "Roger. Opening Nexus News.", act: () => onOpen("news") };
    if (/vault|timetable|scheme/.test(t)) return { text: "Roger. Study Vault.", act: () => onOpen("vault") };
    if (/draft|letter|document/.test(t)) return { text: "Done. It's in your notifications.", act: () => onNote(`📄 Draft ready: "Letter of Acceptance — ${course}".`) };
    return null;
  };

  const say = async (text: string) => {
    setState("voice");
    let ended = false;
    try {
      const p = playVoice(text, () => { ended = true; setState("idle"); });
      const ok = await p;
      if (!ok || ended) setState("idle"); else setState("speaking");
    } catch { setState("idle"); }
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
          // Show the words in the box first so the student can fix them before sending.
          if (text) { setInput((v) => (v ? `${v} ${text}` : text)); setTimeout(() => box.current?.focus(), 50); }
          else toast("Didn't catch that — try again.");
        } catch { setState("idle"); toast.error("Voice failed — check your connection."); }
      };
      rec.current = mr; mr.start(); setState("listening");
      setTimeout(() => mr.state === "recording" && mr.stop(), 12000);
    } catch { toast.error("Allow microphone access to talk to Nexus."); }
  };

  const label = { idle: "Tap the mic and talk", listening: "Listening… tap to send", thinking: "Thinking…", voice: "Preparing voice… please wait", speaking: "Speaking…" }[state];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm animate-fade sm:items-center sm:p-4" onClick={onClose}>
      <div className="card-solid flex h-[88dvh] w-full max-w-2xl flex-col rounded-t-[2rem] sm:h-[86dvh] sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <NexusOrb size={38} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="flex items-center gap-1 font-display font-bold">Nexus <BadgeCheck className="h-4 w-4 fill-primary text-primary-foreground" /></p>
            <p className={`truncate text-xs ${state === "idle" ? "text-muted-foreground" : "busy-glow text-primary"}`}>{label}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="space-y-5">
            {msgs.map((m, i) => m.from === "me" ? (
              <div key={i} className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-primary px-4 py-2.5 text-[16px] leading-relaxed text-primary-foreground">{m.text}</p></div>
            ) : (
              <div key={i} className="flex gap-3">
                <Avatar faculty={faculty} size={30} />
                <div className="min-w-0 flex-1 whitespace-pre-wrap pt-1 text-[16px] leading-[1.75] text-foreground/95">
                  {m.fresh !== false ? m.text.split(" ").map((w, j) => <span key={j} className="word-up" style={{ animationDelay: `${Math.min(j * 28, 2400)}ms` }}>{w} </span>) : m.text}
                </div>
              </div>
            ))}
            {(state === "thinking" || state === "voice") && (
              <div className="flex items-center gap-3"><Avatar faculty={faculty} size={30} /><span className="typing-dots" aria-label="Nexus is typing"><i /><i /><i /></span><span className="text-xs text-muted-foreground">{state === "voice" ? "Preparing voice…" : "Thinking…"}</span></div>
            )}
          </div>
          <div ref={end} />
        </div>
        <div className="shrink-0 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {chips.map((c) => <button key={c} onClick={() => send(c)} className="shrink-0 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs hover:bg-secondary">{c}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="rounded-3xl border border-border bg-input/40 p-2 focus-within:border-primary/60">
            <textarea ref={box} value={input} rows={2} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer: fine)").matches) { e.preventDefault(); void send(input); } }}
              placeholder={state === "listening" ? "Listening… tap stop when done" : "Ask Nexus anything about your course…"}
              className="block max-h-[180px] min-h-[52px] w-full resize-none bg-transparent px-2 py-1.5 text-[16px] leading-relaxed outline-none" />
            <div className="mt-1 flex items-center justify-between">
              <button type="button" onClick={mic} aria-label={state === "listening" ? "Stop recording" : "Talk"} className={`flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium ${state === "listening" ? "animate-pulse bg-destructive text-destructive-foreground" : "bg-secondary hover:bg-secondary/70"}`}>
                {state === "listening" ? <><Square className="h-4 w-4" /> Stop</> : <><Mic className="h-4 w-4" /> Speak</>}
              </button>
              <button type="submit" disabled={!input.trim() || state === "thinking"} aria-label="Send" className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </div>
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
    if (!navigator.onLine) { setErr("You're offline. Quizzes need internet — your lesson is still saved."); return; }
    try {
      const r = await makeQuiz({ data: { title: lesson.title, code: lesson.code, body: `${lesson.body}\nTrick: ${lesson.trick}\nTrap: ${lesson.trap}`, level, difficulty: d } });
      if (r.questions.length) setQs(r.questions);
      else setErr(r.error === "busy" ? "Many students are practising now. Try again in a few seconds." : r.error === "credits" ? "Quiz maker is resting for today. Try again later." : "Couldn't build this quiz. Tap a level to try again.");
    } catch { setErr("Connection dropped. Tap a level to try again."); }
  };
  const q = qs?.[i];
  const done = qs && i >= qs.length;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/85 animate-fade sm:items-center sm:p-4" onClick={onClose}>
      <div className="card-solid flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[2rem] p-5 sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-gold">Practice quiz · {lesson.code}</p><p className="truncate font-display text-lg font-bold">{lesson.title}</p></div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {(["easy", "medium", "hard"] as const).map((d) => <button key={d} onClick={() => start(d)} className={`rounded-xl py-2.5 text-sm font-semibold capitalize ${diff === d ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{d}</button>)}
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!diff && <p className="text-sm text-muted-foreground">Pick a level. Nexus writes 4 fresh questions with explanations.</p>}
          {diff && !qs && !err && <div className="flex items-center gap-3 py-6"><span className="typing-dots"><i /><i /><i /></span><span className="busy-glow text-sm text-primary">Writing your questions…</span></div>}
          {err && <p className="rounded-2xl bg-warning/15 p-4 text-sm">{err}</p>}
          {q && (
            <div>
              <p className="text-xs text-muted-foreground">Question {i + 1} of {qs.length}</p>
              <p className="mt-1 text-[17px] font-semibold leading-snug">{q.q}</p>
              <div className="mt-3 space-y-2">
                {q.options.map((o, k) => {
                  const state = pick === null ? "" : k === q.answer ? "border-emerald bg-emerald/15" : k === pick ? "border-destructive bg-destructive/15" : "opacity-60";
                  return <button key={k} disabled={pick !== null} onClick={() => { setPick(k); if (k === q.answer) setScore((x) => x + 1); }} className={`w-full rounded-2xl border border-border px-4 py-3 text-left text-[15px] ${state}`}>{o}</button>;
                })}
              </div>
              {pick !== null && (
                <div className="mt-3 rounded-2xl bg-secondary/60 p-4 text-[15px] leading-relaxed">
                  <p className="font-semibold">{pick === q.answer ? "Correct." : "Not quite."}</p><p className="mt-1">{q.why}</p>
                  <button onClick={() => { setI(i + 1); setPick(null); }} className="mt-3 w-full rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground">{i + 1 < qs.length ? "Next question" : "See score"}</button>
                </div>
              )}
            </div>
          )}
          {done && (
            <div className="py-4 text-center">
              <p className="font-display text-4xl font-bold">{score}/{qs.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">{score === qs.length ? "Perfect. You own this topic." : score >= qs.length / 2 ? "Good. Read the exam trap once more and retry." : "Read the lesson again, then try Easy first."}</p>
              <button onClick={() => diff && start(diff)} className="mt-4 rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground">New questions</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
