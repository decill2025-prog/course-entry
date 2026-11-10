import { createServerFn } from "@tanstack/react-start";

const toB64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Strips markdown/emoji noise so the text reads well on screen and through the voice. */
export function cleanText(t: string): string {
  return t
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\*\*\*|\*\*|__|\*|`|#{1,6}\s?/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cleans chat text for the screen but keeps fenced code blocks intact so tech students can copy them. */
export function cleanChat(t: string): string {
  return t.split(/(```[\s\S]*?```)/g).map((p) => (p.startsWith("```") ? p : cleanText(p))).join("").trim();
}

/** What the voice should read: code becomes a short pointer, never raw code. */
export function speechText(t: string): string {
  return t.replace(/```[\s\S]*?```/g, " I dropped the code on your screen. ").replace(/[ \t]+/g, " ").trim();
}

/** Text the voice can read smoothly: no symbols, slashes, abbreviations or lists. */
export function speakable(t: string): string {
  return cleanText(t)
    .replace(/\be\.g\.?/gi, "for example").replace(/\bi\.e\.?/gi, "that is").replace(/\betc\.?/gi, "and so on")
    .replace(/\s*\/\s*/g, " or ").replace(/&/g, " and ").replace(/[\[\]{}()<>|~^_=+]/g, " ")
    .replace(/\n+/g, ". ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim();
}

/** True for plain greetings like "hi", "hello", "good morning", "how far". */
export function isGreeting(q: string): boolean {
  const s = q.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  return /^(hi+|hey+|hello+|helo|yo|sup|how far|howdy|good (morning|afternoon|evening|day)|hi nexus|hello nexus|hey nexus)( nexus| there| bro| guy)?$/.test(s);
}

type Turn = { role: "user" | "assistant"; content: string };
type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

// Rotates through up to 5 Groq keys; on 429/5xx moves to the next key, then falls back to CleanAPIs.
let cursor = 0;
async function chat(keys: string[], clean: string | undefined, messages: ChatMsg[], opts: { json?: boolean; max?: number } = {}): Promise<string | null> {
  const n = keys.length;
  const models = [{ model: "qwen/qwen3.8-27b", reasoning_effort: "none" }, { model: "openai/gpt-oss-20b", reasoning_effort: "low" }];
  for (let i = 0; i < n; i++) {
    const key = keys[(cursor + i) % n]!;
    for (const m of models) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", signal: AbortSignal.timeout(9000),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...m, temperature: 0.6, max_tokens: opts.max ?? 1200, messages,
            ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          }),
        });
        if (res.ok) {
          const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const t = (j.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
          if (t) { cursor = (cursor + i + 1) % n; return t; }
        } else {
          console.error("groq", m.model, res.status);
          if (res.status === 429) break;
        }
      } catch (e) { console.error("groq err", e); }
    }
  }
  if (!clean) return null;
  for (const model of ["deepseek-v4-flash-0731", "gemini-3.6-flash"]) {
    try {
      const res = await fetch("https://cleanapis.com/v1/chat/completions", {
        method: "POST", signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Bearer ${clean}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, temperature: 0.6, max_tokens: opts.max ?? 1200, messages, ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
      });
      if (!res.ok) { console.error("cleanapis", model, res.status); continue; }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const t = (j.choices?.[0]?.message?.content ?? "").trim();
      if (t) return t;
    } catch (e) { console.error("cleanapis err", e); }
  }
  return null;
}

const groqKeys = () => ["GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_API_KEY_3", "GROQ_API_KEY_4", "GROQ_API_KEY_5"].map((k) => process.env[k]).filter((v): v is string => !!v);

/** Nexus chat brain. */
export const askJarvis = createServerFn({ method: "POST" })
  .inputValidator((d: { question: string; course: string; level: string; history?: Turn[] | undefined }) => ({
    question: String(d.question ?? "").slice(0, 600),
    course: String(d.course ?? "").slice(0, 80),
    level: String(d.level ?? "").slice(0, 20),
    history: (Array.isArray(d.history) ? d.history : []).slice(-6).map((t) => ({
      role: t.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(t.content ?? "").slice(0, 600),
    })),
  }))
  .handler(async ({ data }) => {
    if (isGreeting(data.question)) {
      return { text: `Hi! I'm Nexus, your ${data.course} coursemate at FUTES. What topic should we make easy today?`, error: null };
    }
    const tech = /computer|software|cyber|data|information|informatics|telecom|electr|mechatron|robotic|artificial|machine learn|statistics/i.test(data.course);
    const system = `You are Nexus, a warm senior coursemate at FUTES (Federal University of Technology and Environmental Sciences), Iyin-Ekiti, Nigeria. The student is ${data.level}, studying ${data.course}. Your answers are read on screen AND spoken aloud, so write the way a clear teacher talks.
First, answer exactly what the student said. If it is small talk, a thank-you or a question about you, reply naturally in one or two friendly sentences and ask what topic they want help with. Never start a lesson they did not ask for.
When they ask about a topic: short, clear sentences under 15 words. State the core concept clearly and directly in standard academic English. If an analogy helps, use an accurate physical, biological, or logical analogy (like how gravity pulls or how gates open), never forced street slang, vehicles, or food tropes. Give the plain rule in one or two sentences. Add one vivid, logical memory hook. End with the exact exam mistake lecturers look for and how to avoid it. Under 110 words.
Always plain text: no asterisks, hashtags, bullet symbols or emojis. Explain any technical word the moment you use it.${tech ? `\nWhen the student asks you to write, show or explain code, include one short working example in a fenced code block with the language, like \`\`\`python\\ncode here\\n\`\`\`. Twenty lines maximum, real and runnable, with short comments. After the block add one plain sentence saying how it works and what to change to practise. Only use code when they ask for it; never speak the code aloud.` : ""}`;

    const text = await chat(groqKeys(), process.env["CLEANAPIS_API_KEY"], [{ role: "system", content: system }, ...data.history, { role: "user", content: data.question }]);
    const clean = text ? cleanChat(text) : null;
    return { text: clean, error: clean ? null : "busy" };
  });

export type AIPost = { title: string; hook: string; body: string; steps: string[]; example: string; trick: string; trap: string; points: string[]; say: string };

const POST_RULES = `Teaching style (article-length, deep, fully detailed so a student masters it in two reads):
1. Definition: State the foundational concept clearly and directly in standard academic English. Short sentences under 15 words. Explain any technical term immediately. Strictly no street slang, danfo, suya, or informal market analogies.
2. When it was found (Origin): State who formalized or discovered it, the era or approximate year, and the real practical problem they needed to solve.
3. Explanation and How it works: Give the step-by-step mechanism and underlying logic. Explain why it behaves the way it does using natural, accurate examples relevant to their course.
4. How it helps (Practical utility): Explain where and how it is applied in industry, engineering, science, or environmental practice, including authentic Nigerian context where relevant.
5. What lecturers test (Exam trap): The exact mistake students make on university exams, and the clear rule to avoid it.
Plain text only. No asterisks, hashtags, emojis or markdown symbols.`;

/** Writes one scheme-of-work lesson post and stores it in the shared library so every domain sees it. */
export const generatePost = createServerFn({ method: "POST" })
  .inputValidator((d: { level: string; course: string; code: string; courseTitle: string; topic: string }) => ({
    level: String(d.level).slice(0, 20), course: String(d.course).slice(0, 80), code: String(d.code).slice(0, 12),
    courseTitle: String(d.courseTitle).slice(0, 80), topic: String(d.topic).slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const none = { post: null as AIPost | null, id: null as string | null };
    const system = `You write deep, comprehensive academic lesson articles for FUTES Nexus, a study feed for Nigerian university students, following the official NUC CCMAS scheme of work. The reader is a ${data.level} ${data.course} student. Stay strictly on the given course code and topic, and frame every example and use-case around what a ${data.course} professional actually does.
${POST_RULES}
Write the body as 4 full, substantive paragraphs separated by double linebreaks:
Paragraph 1: Clear, formal academic definition.
Paragraph 2: Discovery and historical origin (when it was found, who began it, and why).
Paragraph 3: Complete explanation of how and why it works step by step.
Paragraph 4: Practical importance in real-world industry and Nigerian practice.

Reply ONLY with JSON in this exact structure:
{
  "title": "Clear academic title under 8 words",
  "hook": "One sentence stating why this topic is essential in real life",
  "body": "The 4 detailed paragraphs separated by \\n\\n (around 220-320 words total)",
  "steps": ["Step 1 explanation", "Step 2 explanation", "Step 3 explanation", "Step 4 explanation"],
  "example": "One realistic worked example with specific numbers, code, or field case study under 70 words",
  "trick": "One logical memory aid in proper English",
  "trap": "The exact exam mistake and how to avoid it",
  "points": ["Three key points to remember", "Second point", "Third point"],
  "say": "A smooth spoken summary of the definition, how it works, and the exam rule written in short 10-14 word sentences so the voice reads it fluently without stumbling (around 60-90 words)"
}`;

    const raw = await chat(groqKeys(), process.env["CLEANAPIS_API_KEY"], [
      { role: "system", content: system },
      { role: "user", content: `${data.code} ${data.courseTitle} — topic: ${data.topic}` },
    ], { json: true, max: 1500 });
    if (!raw) return none;

    let post: AIPost;
    try {
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Partial<AIPost>;
      const arr = (v: unknown) => (Array.isArray(v) ? v.map((x) => cleanText(String(x))).slice(0, 6) : []);
      if (!j.title || !j.body) return none;
      const c = (v: unknown) => cleanText(String(v ?? ""));
      post = { title: c(j.title), hook: c(j.hook), body: c(j.body), steps: arr(j.steps), example: c(j.example), trick: c(j.trick), trap: c(j.trap), points: arr(j.points), say: c(j.say) };
    } catch { return none; }

    const id = `ai-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("nexus_posts").upsert({ id, level: data.level, course: data.course, code: data.code, topic: data.topic, payload: { ...post, courseTitle: data.courseTitle } }, { onConflict: "level,course,code,topic", ignoreDuplicates: true });
    } catch (e) { console.error("save post", e); }

    return { post, id };
  });

export type SharedPost = { id: string; level: string; course: string; code: string; topic: string; created_at: string; payload: AIPost & { courseTitle: string } };

async function publicDb() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
      h.set("apikey", key);
      return fetch(input, { ...init, headers: h });
    } },
  });
}

/** Shared lessons for one level + course (newest first). Works on any domain because it runs on the server. */
export const listShared = createServerFn({ method: "POST" })
  .inputValidator((d: { level: string; course: string }) => ({ level: String(d.level).slice(0, 20), course: String(d.course).slice(0, 80) }))
  .handler(async ({ data }) => {
    try {
      const db = await publicDb();
      const { data: rows, error } = await db.from("nexus_posts").select("id, level, course, code, topic, created_at, payload").eq("level", data.level).eq("course", data.course).order("created_at", { ascending: false }).limit(40);
      if (error) { console.error("listShared", error.message); return { posts: [] as SharedPost[] }; }
      return { posts: (rows ?? []) as unknown as SharedPost[] };
    } catch (e) { console.error(e); return { posts: [] as SharedPost[] }; }
  });

/** One lesson by id, for shared links opened by any student. */
export const getShared = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => ({ id: String(d.id).slice(0, 60) }))
  .handler(async ({ data }) => {
    try {
      const db = await publicDb();
      const { data: row } = await db.from("nexus_posts").select("id, level, course, code, topic, created_at, payload").eq("id", data.id).maybeSingle();
      return { post: (row ?? null) as unknown as SharedPost | null };
    } catch { return { post: null as SharedPost | null }; }
  });

export type QuizQ = { q: string; options: string[]; answer: number; why: string };

/** Practice quiz for one lesson: Groq key pool, then CleanAPIs. Works on every domain (no Lovable gateway). */
export const makeQuiz = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; code: string; body: string; level: string; difficulty: string }) => ({
    title: String(d.title).slice(0, 120), code: String(d.code).slice(0, 12), body: String(d.body).slice(0, 2000),
    level: String(d.level).slice(0, 20), difficulty: ["easy", "medium", "hard"].includes(d.difficulty) ? d.difficulty : "medium",
  }))
  .handler(async ({ data }) => {
    const level = { easy: "simple recall of the main idea", medium: "a typical university test question that applies the idea", hard: "a tricky past-question style item built around the common exam trap" }[data.difficulty];
    try {
      const text = await chat(groqKeys(), process.env["CLEANAPIS_API_KEY"], [
        { role: "system", content: `You set practice questions for ${data.level} Nigerian university students. Write exactly 4 multiple-choice questions on the lesson. Difficulty: ${level}. Each has 4 short options and one correct answer (index 0-3). The explanation is 1-2 plain sentences. Plain text, no markdown. Reply ONLY with JSON: {"questions":[{"q":"...","options":["a","b","c","d"],"answer":0,"why":"..."}]}` },
        { role: "user", content: `${data.code} — ${data.title}\n\n${data.body}` },
      ], { json: true, max: 700 });
      if (!text) return { questions: [] as QuizQ[] };
      const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { questions?: QuizQ[] };
      const qs = Array.isArray(j.questions) ? j.questions.filter((q) => q.q && Array.isArray(q.options) && q.options.length === 4 && typeof q.answer === "number" && q.why).slice(0, 4) : [];
      return { questions: qs };
    } catch { return { questions: [] as QuizQ[] }; }
  });

// Groq Whisper cuts sentences and hallucinates "Thank you" — reject ghost transcripts.
const isGhostTranscript = (t: string) => /^(thank you|thanks for watching|subscribe|subtitles by|you)\.?$/i.test(t.trim());

/** Speech-to-text: Deepgram Nova-3 → Nova-2. Never Groq. */
export const transcribe = createServerFn({ method: "POST" })
  .inputValidator((d: { base64: string; mime: string }) => ({
    base64: String(d.base64 ?? "").slice(0, 3_000_000),
    mime: String(d.mime ?? "audio/webm").slice(0, 40),
  }))
  .handler(async ({ data }) => {
    const dg = process.env["DEEPGRAM_API_KEY"];
    if (!dg || !data.base64) return { text: null as string | null };
    const bin = atob(data.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    for (const model of ["nova-3", "nova-2"]) {
      try {
        const res = await fetch(`https://api.deepgram.com/v1/listen?model=${model}&language=en&smart_format=true&punctuate=true`, {
          method: "POST", signal: AbortSignal.timeout(10000),
          headers: { Authorization: `Token ${dg}`, "Content-Type": data.mime.split(";")[0] || "audio/webm" },
          body: bytes,
        });
        if (!res.ok) { console.error("deepgram stt", model, res.status); continue; }
        const j = (await res.json()) as { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } };
        const t = (j.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "").trim();
        return { text: isGhostTranscript(t) ? null : t };
      } catch (e) { console.error("deepgram stt err", e); }
    }
    return { text: null as string | null };
  });

/** Text-to-speech: Deepgram Aura-2 → second Deepgram voice → Microsoft neural. Never Groq, never browser. */
export const speak = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => ({ text: speakable(String(d.text ?? "")).slice(0, 3000) }))
  .handler(async ({ data }) => {
    const none = { audio: null as string | null, mime: "audio/mpeg" };
    if (!data.text) return none;
    const dg = process.env["DEEPGRAM_API_KEY"];
    if (dg) {
      for (const model of ["aura-2-thalia-en", "aura-asteria-en"]) {
        try {
          const res = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`, {
            method: "POST", signal: AbortSignal.timeout(6000),
            headers: { Authorization: `Token ${dg}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.text }),
          });
          if (res.ok) return { audio: toB64(await res.arrayBuffer()), mime: "audio/mpeg" };
          console.error("deepgram", model, res.status);
        } catch (e) { console.error("deepgram err", model, e); }
      }
    }
    // Fallback: Microsoft Edge neural voice via edge-tts endpoint (never Groq, never browser)
    try {
      const { EdgeTTS } = await import("edge-tts-node");
      const tts = new EdgeTTS({ voice: "en-NG-AbeoNeural" });
      const r = await tts.synthesize(data.text);
      return { audio: toB64(await r.audio.arrayBuffer()), mime: "audio/mpeg" };
    } catch (e) { console.error("edge tts", e); }
    return none;
  });
