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
  title: "New student guide: what to bring for physical registration",
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
  const my = ++voiceToken; // only the newest request may play — never two voices at once
  try {
    if (!navigator.onLine || !unlocked) {
      if (kittenReady()) return speakOffline(text, onEnd);
    }
    const clean = speechText(text);
    const r = await speak({ data: { text: clean } });
    if (my !== voiceToken) return false;
    if (r.audio) {
      player = new Audio(`data:${r.mime};base64,${r.audio}`);
      player.onended = () => { if (my === voiceToken) { player = null; onEnd?.(); } };
      player.onerror = () => { if (my === voiceToken) { player = null; onEnd?.(); } };
      await player.play();
      return true;
    }
  } catch { /* network / server issue */ }
  if (my === voiceToken && kittenReady()) return speakOffline(text, onEnd);
  return false;
}

function stopVoice() {
  voiceToken++;
  if (player) {
    try { player.pause(); player.src = ""; } catch { /* ignore */ }
    player = null;
  }
  if (node) {
    try { node.stop(); node.disconnect(); } catch { /* ignore */ }
    node = null;
  }
  stopKitten();
}

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fromShared(p: SharedPost): StoredPost {
  return {
    id: p.id,
    code: p.code,
    title: p.title,
    tag: p.tag,
    faculty: p.faculty,
    icon: p.icon,
    image: p.image,
    say: p.say,
    body: p.body,
    points: p.points,
    trap: p.trap,
    memory: p.memory,
    at: p.created_at,
  };
}

export function Hub({ profile, onExit }: { profile: Profile; onExit: () => void }) {
  const [tab, setTab] = useState<"feed" | "vault">("feed");
  const [orb, setOrb] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [news, setNews] = useState(false);
  const [online, setOnline] = useState(true);
  const [copied, setCopied] = useState(false);
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
      void getShared({ data: { id } }).then((r) => { if (r.post) setExtra(fromShared(r.post)); });
    }
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const [lastY, setLastY] = useState(0);
  const onScroll = (e: React.UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    if (y > 100 && y > lastY + 8) setHidden(true);
    else if (y < lastY - 8 || y < 60) setHidden(false);
    setLastY(y);
  };

  const go = (t: "feed" | "vault") => {
    stopVoice(); setPlaying(null); setLoadingVoice(null);
    setTab(t);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const writeMore = async (count = SESSION_BATCH) => {
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
        const p = toStored(r.post);
        const updated = mergePosts([p], loadPosts(profile.level, profile.course));
        savePosts(profile.level, profile.course, updated);
        setAiPosts(updated);
      }
    } finally {
      busy.current = false; setWriting(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const saved = loadPosts(profile.level, profile.course);
    setAiPosts(saved);
    void (async () => {
      let merged = saved;
      if (navigator.onLine) {
        const r = await listShared({ data: { level: profile.level, faculty: profile.faculty, limit: 30 } }).catch(() => ({ posts: [] }));
        if (!alive) return;
        merged = mergePosts(r.posts.map(fromShared), saved);
        savePosts(profile.level, profile.course, merged);
        setAiPosts(merged);
      }
      if (!postedToday(new Date(), merged)) void writeMore(1);
    })();
    return () => { alive = false; };
  }, [profile.level, profile.course]);

  const listenTo = async (l: Lesson) => {
    unlockVoice();
    if (playing === l.id) { stopVoice(); setPlaying(null); return; }
    setLoadingVoice(l.id);
    const text = `${l.title}. Course code: ${l.code}. ${l.say}. Remember: ${l.memory}. Common exam mistake: ${l.trap}.`;
    const ok = await playVoice(text, () => setPlaying(null));
    setLoadingVoice(null);
    if (ok) setPlaying(l.id);
    else toast.error("Voice needs internet or offline voice installed.", { description: "You can download Kitten offline voice inside Study Vault." });
  };

  const sharePost = async (id: string, title: string) => {
    const url = `${window.location.origin}/?post=${encodeURIComponent(id)}`;
    if (navigator.share) {
      try { await navigator.share({ title, text: `${title} on FUTES Nexus`, url }); return; } catch { /* ignore */ }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied to clipboard", { description: "Send it to your FUTES coursemates." });
    setTimeout(() => setCopied(false), 2000);
  };

  const viewed = (all.find((p) => p.id === view) ?? (extra?.id === view ? extra : undefined)) as (Lesson & Partial<StoredPost>) | undefined;

  return (
    <div className="nexus-shell flex flex-col font-sans text-foreground">
      <header className="nexus-header z-30 flex flex-col border-b border-border/40 bg-graphite/95 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-3.5 sm:px-4">
          <div className="flex items-center gap-2.5">
            <img src="/futes-crest.jpg" alt="FUTES crest" className="h-8 w-8 rounded-full border border-primary/40 object-cover" />
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 font-display text-sm font-extrabold tracking-wide text-primary">
                FUTES <span className="text-foreground/40">//</span> NEXUS
              </div>
              <p className="line-clamp-1 max-w-[200px] text-[11px] text-muted-foreground sm:max-w-none">
                {lvl} · {course}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!online && (
              <span className="flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-semibold text-gold">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
            <button onClick={() => setNews(true)} aria-label="Notifications" className="relative rounded-full p-2 text-foreground/80 hover:bg-secondary">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-gold" />
            </button>
            <button onClick={onExit} aria-label="Change level or course" className="flex items-center gap-1 rounded-full border border-border/60 bg-secondary/60 px-2.5 py-1 text-xs font-semibold text-foreground/85 hover:bg-secondary">
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Switch</span>
            </button>
          </div>
        </div>
      </header>

      <main ref={scroller as unknown as React.RefObject<HTMLDivElement>} onScroll={onScroll} className="nexus-main flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-xl space-y-4 p-3.5 pb-28 sm:p-4">
          {tab === "feed" && (
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
                <div className="card-solid rounded-2xl p-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="busy-glow flex items-center gap-1.5 text-xs text-primary"><Sparkles className="h-3.5 w-3.5" /> Writing a new lesson from your scheme of work…</p>
                  </div>
                </div>
              )}

              {(aiPosts.length > 0 ? aiPosts : lessons.slice(0, 1)).map((l, n) => {
                const ai = l as Lesson & Partial<StoredPost>;
                return (
                  <article key={l.id} className="feed-card card-solid overflow-hidden rounded-3xl">
                    <div className="p-4 pb-3">
                      <Author faculty={profile.faculty} name={<><CourseName name={course} /> AI</>} meta={`${ai.at ? timeAgo(ai.at) : `${n * 7 + 3}m`} · ${lvl} · ${l.code}`} />
                      <h2 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight">{l.title}</h2>
                      <p className="mt-1 font-mono text-xs font-semibold text-primary">{l.tag}</p>
                      <p className="mt-2.5 text-[17px] leading-relaxed text-foreground/90">{l.say}</p>
                    </div>
                    <img src={l.image} alt={l.title} loading="lazy" className="aspect-[16/9] w-full object-cover" />
                    <div className="grid grid-cols-3 gap-2 p-3">
                      <button onClick={() => setView(l.id)} className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"><BookOpen className="h-4 w-4" /> Read</button>
                      <button onClick={() => listenTo(l)} className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 text-sm font-semibold">{loadingVoice === l.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : playing === l.id ? <Pause className="h-4 w-4 text-primary" /> : <Headphones className="h-4 w-4" />} Listen</button>
                      <button onClick={() => sharePost(l.id, l.title)} className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 text-sm font-semibold"><Share2 className="h-4 w-4" /> Share</button>
                    </div>
                  </article>
                );
              })}

              {online && remainingToday() === 0 ? (
                <div ref={sentinel} className="caught-up rounded-3xl p-[2px]">
                  <div className="rounded-[calc(1.5rem-2px)] bg-graphite px-5 py-7 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-gold" />
                    <p className="text-shimmer mt-3 font-display text-2xl font-extrabold">You're all caught up for today</p>
                    <p className="mt-2 text-[15px] text-foreground/85">Come back tomorrow for your next {course} lesson from your scheme of work.</p>
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button onClick={() => (aiPosts[0] ?? all[0]) && setView((aiPosts[0] ?? all[0])!.id)} className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">Revise a lesson</button>
                      <button onClick={() => go("vault")} className="rounded-xl bg-secondary py-2.5 text-sm font-semibold">Study Vault</button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={sentinel} className="py-6 text-center text-xs text-muted-foreground">{online ? `Loading more for ${lvl} ${course}…` : "You're offline — these lessons are saved on your phone."}</div>
            </>
          )}

          {tab === "vault" && (
            <div className="space-y-4">
              <button onClick={() => { void warmKitten().then((ok) => setVoiceOffline(ok)); }} className="card-solid flex w-full items-center justify-between rounded-2xl p-3.5 text-left">
                <span className="min-w-0"><span className="block text-sm font-semibold">{voiceOffline ? "Offline voice is ready" : "Download offline voice"}</span><span className="block text-xs text-muted-foreground">Kitten neural voice reads lessons with no internet.</span></span>
                <span className="rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold">{voiceOffline ? "Ready" : "Install"}</span>
              </button>
              <Vault lessons={all} course={course} lvl={lvl} faculty={profile.faculty} onOpen={setView} onAsk={() => { unlockVoice(); setOrb(true); }} />
            </div>
          )}
        </div>
      </main>

      <nav aria-label="Primary" className={`nexus-dock fixed inset-x-0 bottom-0 z-30 transition-transform duration-300 ${hidden ? "translate-y-full" : "translate-y-0"}`}>
        <div className="mx-auto max-w-md px-4 pb-4">
          <div className="flex h-16 items-center justify-around rounded-3xl border border-border/50 bg-graphite/95 px-3 shadow-2xl backdrop-blur-2xl">
            <button onClick={() => go("feed")} className={`flex flex-col items-center gap-1 px-4 py-1 text-xs font-semibold transition ${tab === "feed" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Home className="h-5 w-5" />
              <span>Feed</span>
            </button>

            <button onClick={() => { unlockVoice(); setOrb(true); }} aria-label="Talk to Nexus AI" className="group -mt-6 flex flex-col items-center focus:outline-none">
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-graphite p-1 shadow-2xl ring-4 ring-background">
                <JarvisOrb size={54} />
              </span>
              <span className="mt-1 text-[11px] font-bold text-primary group-hover:underline">Nexus AI</span>
            </button>

            <button onClick={() => go("vault")} className={`flex flex-col items-center gap-1 px-4 py-1 text-xs font-semibold transition ${tab === "vault" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Library className="h-5 w-5" />
              <span>Vault</span>
            </button>
          </div>
        </div>
      </nav>

      {viewed && <Modal lesson={viewed} course={course} lvl={lvl} faculty={profile.faculty} onClose={() => setView(null)} onQuiz={() => { setQuiz(viewed); setView(null); }} onListen={() => listenTo(viewed)} onShare={() => sharePost(viewed.id, viewed.title)} playing={playing === viewed.id} loadingVoice={loadingVoice === viewed.id} />}

      {news && (
        <div role="dialog" aria-modal="true" aria-label={NEWS.title} className="fixed inset-0 z-50 flex flex-col bg-graphite">
          <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
            <button onClick={() => setNews(false)} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back to feed</button>
            <span className="text-xs font-semibold text-gold">Student guide</span>
            <button onClick={() => setNews(false)} className="rounded-full p-1.5 text-muted-foreground"><X className="h-5 w-5" /></button>
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

      {quiz && <QuizModal lesson={quiz} course={course} level={profile.level} onClose={() => setQuiz(null)} />}

      {orb && <Nexus lessons={lessons} course={course} level={profile.level} faculty={profile.faculty}
        onClose={() => { stopVoice(); setOrb(false); }}
        onOpen={(id) => { stopVoice(); setOrb(false); setView(id); }}
        onNote={(note) => { setView(null); setOrb(false); toast.success("Saved to Study Vault", { description: note }); }}
      />}
    </div>
  );
}

function JarvisOrb({ size = 48 }: { size?: number }) {
  return (
    <span className="jarvis block" style={{ width: size, height: size }}>
      <span className="jarvis-ring" style={{ inset: 3 }} />
      <span className="jarvis-ring-rev" style={{ inset: size * 0.17 }} />
      <span className="jarvis-core" style={{ inset: size * 0.3 }} />
    </span>
  );
}

function CourseName({ name }: { name: string }) {
  return <span className="font-semibold">{name}</span>;
}

function Vault({ lessons, course, lvl, faculty, onOpen, onAsk }: { lessons: Lesson[]; course: string; lvl: string; faculty: string; onOpen: (id: string) => void; onAsk: () => void }) {
  const [tab, setTab] = useState<"all" | "table" | "memory" | "traps">("all");
  const tt = TIMETABLE[course] ?? TIMETABLE["Software Engineering"];
  return (
    <div className="space-y-4">
      <div className="card-solid rounded-3xl p-5">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-primary" />
          <div>
            <h2 className="font-display text-xl font-bold">{course} Study Vault</h2>
            <p className="text-xs text-muted-foreground">{lvl} scheme of work · {lessons.length} topics</p>
          </div>
        </div>

        <div className="mt-4 flex gap-1 rounded-2xl bg-secondary/60 p-1 text-xs font-semibold">
          {(["all", "table", "memory", "traps"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-xl py-2 capitalize transition ${tab === t ? "bg-graphite text-foreground shadow" : "text-muted-foreground"}`}>{t === "table" ? "Timetable" : t}</button>
          ))}
        </div>
      </div>

      {tab === "all" && (
        <div className="space-y-2.5">
          {lessons.map((l, i) => (
            <button key={l.id} onClick={() => onOpen(l.id)} className="card-solid flex w-full items-center justify-between rounded-2xl p-3.5 text-left transition hover:border-primary/40">
              <div className="min-w-0 flex-1 pr-3">
                <span className="font-mono text-xs font-semibold text-primary">{l.code}</span>
                <p className="truncate text-sm font-semibold">{l.title}</p>
                <p className="truncate text-xs text-muted-foreground">{l.tag}</p>
              </div>
              <span className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">Topic {i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "memory" && (
        <div className="space-y-2.5">
          {lessons.map((l) => (
            <div key={l.id} className="card-solid rounded-2xl p-3.5">
              <span className="font-mono text-xs font-semibold text-primary">{l.code} · {l.title}</span>
              <p className="mt-1.5 text-sm font-medium text-foreground/90">{l.memory}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "traps" && (
        <div className="space-y-2.5">
          {lessons.map((l) => <div key={l.id} className="rounded-2xl bg-destructive/10 p-3 text-sm"><p className="font-mono text-[11px] font-semibold text-destructive">{l.code}</p><p className="mt-1 leading-relaxed">{l.trap}</p></div>)}
        </div>
      )}

      {tab === "table" && (
        <div className="card-solid space-y-2 rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted-foreground">Weekly lecture timetable · 2026/2027</p>
          {tt.map((e) => (
            <div key={e.day} className="flex items-center justify-between border-b border-border/30 py-2 text-xs last:border-none">
              <span className="font-semibold text-primary">{e.day}</span>
              <span>{e.time}</span>
              <span className="font-mono font-bold">{e.code}</span>
              <span className="text-muted-foreground">{e.hall}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onAsk} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
        <Sparkles className="h-4 w-4" /> Ask Nexus AI about your course
      </button>
    </div>
  );
}

function Modal({ lesson, course, lvl, faculty, onClose, onQuiz, onListen, onShare, playing, loadingVoice }: { lesson: Lesson & Partial<StoredPost>; course: string; lvl: string; faculty: string; onClose: () => void; onQuiz: () => void; onListen: () => void; onShare: () => void; playing: boolean; loadingVoice: boolean }) {
  const Icon = ICONS[lesson.icon] ?? BookOpen;
  return (
    <div role="dialog" aria-modal="true" aria-label={lesson.title} className="fixed inset-0 z-50 flex flex-col bg-graphite">
      <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</button>
        <span className="font-mono text-xs font-bold text-primary">{lesson.code}</span>
        <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground"><X className="h-5 w-5" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-xl space-y-4 p-4 pb-20">
          <Author faculty={faculty} name={<><CourseName name={course} /> AI</>} meta={`${lvl} · ${lesson.code}`} />
          <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight">{lesson.title}</h1>
          <p className="font-mono text-xs font-semibold text-primary">{lesson.tag}</p>

          <img src={lesson.image} alt={lesson.title} className="aspect-[16/9] w-full rounded-3xl object-cover" />

          <div className="flex gap-2">
            <button onClick={onListen} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary py-3 text-sm font-semibold">{loadingVoice ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : playing ? <Pause className="h-4 w-4 text-primary" /> : <Headphones className="h-4 w-4" />}{playing ? "Pause" : "Listen to lesson"}</button>
            <button onClick={onShare} className="flex items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold"><Share2 className="h-4 w-4" /> Share</button>
          </div>

          <p className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-[17px] leading-relaxed text-foreground/95">{lesson.say}</p>

          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold">What a student must understand</h2>
            {lesson.body.map((p, i) => (
              <p key={i} className="text-[17px] leading-8 text-foreground/90">{p}</p>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl bg-secondary/40 p-4">
            <h2 className="font-display text-sm font-bold text-primary">Core takeaway points</h2>
            <ul className="space-y-1.5 text-sm">
              {lesson.points.map((pt) => <li key={pt} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /><span>{pt}</span></li>)}
            </ul>
          </div>

          <div className="rounded-2xl bg-primary/10 p-4">
            <p className="text-xs font-bold text-primary">ONE LINE TO REMEMBER</p>
            <p className="mt-1 text-sm font-medium">{lesson.memory}</p>
          </div>

          <div className="rounded-2xl bg-destructive/10 p-4">
            <p className="text-xs font-bold text-destructive">COMMON EXAM TRAP</p>
            <p className="mt-1 text-sm">{lesson.trap}</p>
          </div>

          <button onClick={onQuiz} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-base font-bold text-primary-foreground shadow-lg shadow-primary/25">
            <Brain className="h-5 w-5" /> Take 4-question revision quiz
          </button>
        </div>
      </div>
    </div>
  );
}

function Nexus({ lessons, course, level, faculty, onClose, onOpen, onNote }: { lessons: Lesson[]; course: string; level: Level; faculty: string; onClose: () => void; onOpen: (id: string) => void; onNote: (n: string) => void }) {
  const [msgs, setMsgs] = useState<Array<{ from: "user" | "ai"; text: string }>>([
    { from: "ai", text: `I am Nexus, your ${level} ${course} tutor. Ask me about your topics, timetable, or exam questions.` },
  ]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [holding, setHolding] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, state]);

  const chips = [`Explain ${lessons[0]?.code ?? "my course"} simply`, "Give me 3 exam questions", "Explain it like I'm 12", "Open Nexus News"];

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || state === "thinking") return;
    setInput("");
    const t = q.toLowerCase();
    const post = lessons.find((p) => t.includes(p.code.toLowerCase()) && /open|show|go/.test(t));
    if (post) { onOpen(post.id); return; }
    const history = msgs.slice(-6);
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setState("thinking");
    try {
      const r = await askJarvis({ data: { question: q, course, level, history } });
      const reply = r.text ?? (r.error === "busy" ? "Lots of students asking right now — give me 10 seconds and ask again." : "I couldn't reach my brain just now. Try again.");
      setMsgs((m) => [...m, { from: "ai", text: reply }]);
      void playVoice(reply);
    } catch {
      setMsgs((m) => [...m, { from: "ai", text: "Offline right now. Read your saved Study Vault lessons or try again with internet." }]);
    } finally {
      setState("idle");
    }
  };

  const startVoice = async () => {
    unlockVoice();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined });
      recRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.start(100);
      setState("listening");
      setHolding(true);
    } catch {
      toast.error("Microphone access needed for voice mode");
      setState("idle");
      setHolding(false);
    }
  };

  const stopVoiceRec = async () => {
    setHolding(false);
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return;
    setState("thinking");
    await new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
      rec.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
    if (blob.size < 1200) { setState("idle"); return; }
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await transcribe({ data: { audioBase64: base64, mimeType: blob.type } });
      if (res.text && res.text.trim().length > 1) {
        await send(res.text.trim());
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
      toast.error("Couldn't hear clearly. Try typing your question.");
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Nexus AI Tutor" className="fixed inset-0 z-50 flex flex-col bg-graphite">
      <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
        <div className="flex items-center gap-2">
          <JarvisOrb size={28} />
          <span className="font-display font-bold">Nexus AI</span>
          <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">{course}</span>
        </div>
        <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground"><X className="h-5 w-5" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.from === "user" ? "bg-primary text-primary-foreground font-medium" : "bg-secondary text-foreground"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {state === "thinking" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Nexus is thinking…
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="border-t border-border/40 p-3 space-y-2 bg-graphite/95">
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {chips.map((c) => (
            <button key={c} onClick={() => void send(c)} className="shrink-0 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-muted-foreground hover:text-foreground">{c}</button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Nexus anything about your course…"
            className="flex-1 rounded-2xl border border-border/60 bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => { if (holding) void stopVoiceRec(); else void startVoice(); }}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${holding ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-secondary text-foreground"}`}
            aria-label={holding ? "Stop recording" : "Speak to Nexus"}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || state === "thinking"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function QuizModal({ lesson, course, level, onClose }: { lesson: Lesson; course: string; level: Level; onClose: () => void }) {
  const [qs, setQs] = useState<QuizQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    void makeQuiz({ data: { course, level, code: lesson.code, topic: lesson.title } }).then((r) => {
      setQs(r.questions);
      setLoading(false);
    });
  }, [course, level, lesson.code, lesson.title]);

  const score = Object.entries(answers).filter(([idx, ans]) => qs[Number(idx)]?.correct === ans).length;

  return (
    <div role="dialog" aria-modal="true" aria-label="Practice Quiz" className="fixed inset-0 z-50 flex flex-col bg-graphite">
      <div className="flex h-14 items-center justify-between border-b border-border/40 px-4">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Exit Quiz</button>
        <span className="font-mono text-xs font-bold text-primary">{lesson.code} Quiz</span>
        <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground"><X className="h-5 w-5" /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="mx-auto max-w-xl space-y-4 pb-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm">Preparing 4 revision questions on {lesson.title}…</p>
            </div>
          ) : qs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p>Couldn't generate quiz right now. Try again in a moment.</p>
            </div>
          ) : (
            <>
              {qs.map((q, i) => (
                <div key={i} className="card-solid space-y-2 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-foreground/95">{i + 1}. {q.q}</p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oIdx) => {
                      const sel = answers[i] === oIdx;
                      const isCorrect = done && q.correct === oIdx;
                      const isWrong = done && sel && q.correct !== oIdx;
                      return (
                        <button
                          key={oIdx}
                          disabled={done}
                          onClick={() => setAnswers((a) => ({ ...a, [i]: oIdx }))}
                          className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs font-medium transition ${
                            isCorrect ? "bg-primary/20 text-primary border border-primary/40" :
                            isWrong ? "bg-destructive/20 text-destructive border border-destructive/40" :
                            sel ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-foreground"
                          }`}
                        >
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  {done && q.explain && <p className="pt-1 text-xs text-muted-foreground">{q.explain}</p>}
                </div>
              ))}

              {!done ? (
                <button
                  disabled={Object.keys(answers).length < qs.length}
                  onClick={() => setDone(true)}
                  className="flex w-full items-center justify-center rounded-2xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-40"
                >
                  Submit & Check Answers
                </button>
              ) : (
                <div className="card-solid rounded-2xl p-4 text-center space-y-2">
                  <p className="font-display text-xl font-bold">You scored {score} / {qs.length}</p>
                  <p className="text-xs text-muted-foreground">{score >= 3 ? "Excellent work! Ready for exam revision." : "Review the lesson again to strengthen this topic."}</p>
                  <button onClick={onClose} className="mt-2 w-full rounded-xl bg-secondary py-2.5 text-xs font-semibold">Done</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Author({ faculty, name, meta, gold = false }: { faculty?: string; name: ReactNode; meta: string; gold?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${gold ? "bg-gold text-graphite" : "bg-primary text-primary-foreground"}`}>
        {gold ? <Sparkles className="h-4 w-4" /> : faculty ? faculty.slice(0, 2).toUpperCase() : "FN"}
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1 font-semibold text-sm">
          {name}
          <BadgeCheck className={`h-4 w-4 ${gold ? "text-gold" : "text-primary"}`} />
        </div>
        <p className="text-[11px] text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}
