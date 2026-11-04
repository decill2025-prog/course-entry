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
  // Fast Qwen first (~200ms, no thinking), GPT-OSS as same-key backup.
  const models = [{ model: "qwen/qwen3.8-27b", reasoning_effort: "none" }, { model: "openai/gpt-oss-20b", reasoning_effort: "low" }];
  for (let i = 0; i < n; i++) {
    const key = keys[(cursor + i) % n]!;
    for (const m of models) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", signal: AbortSignal.timeout(9000),
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...m, temperature: 0.6, max_tokens: opts.max ?? 700, messages,
            ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          }),
        });
        if (res.ok) {
          const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const t = (j.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
          if (t) { cursor = (cursor + i + 1) % n; return t; }
        } else {
          console.error("groq", m.model, res.status);
          if (res.status === 429) break; // this key is rate-limited: next key
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
        body: JSON.stringify({ model, temperature: 0.6, max_tokens: opts.max ?? 700, messages, ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
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
When they ask about a topic: short sentences under 15 words. Start with one everyday Nigerian picture (danfo, suya, NEPA light, market, hostel). Give the plain rule in one or two sentences. Add one vivid memory hook, never a forced acronym. End with the one exam mistake to avoid. Under 110 words.
Always plain text: no asterisks, hashtags, bullet symbols or emojis. Explain any technical word the moment you use it.${tech ? `\nWhen the student asks you to write, show or explain code, include one short working example in a fenced code block with the language, like \`\`\`python\\ncode here\\n\`\`\`. Twenty lines maximum, real and runnable, with short comments. After the block add one plain sentence saying how it works and what to change to practise. Only use code when they ask for it; never speak the code aloud.` : ""}`;
    const text = await chat(groqKeys(), process.env["CLEANAPIS_API_KEY"], [{ role: "system", content: system }, ...data.history, { role: "user", content: data.question }]);
    const clean = text ? cleanChat(text) : null;
    return { text: clean, error: clean ? null : "busy" };
  });

export type AIPost = { title: string; hook: string; body: string; steps: string[]; example: string; trick: string; trap: string; points: string[]; say: string };

const POST_RULES = `Teaching style (this is what makes students understand in one go):
1. Picture first: open with a concrete Nigerian everyday scene the student already knows (danfo bus, suya spot, NEPA light, borehole, market woman, hostel, generator). Map each part of the topic to a part of that scene.
2. Then the real definition in plain words. Short sentences under 15 words. Explain every technical word right away.
3. One small worked example with real numbers or a real case.
4. Memory hook: a vivid, funny or physical image or a short rhyme that makes sense in normal English. Never a forced acronym, never broken English, never "IF-ELSE I FINE".
5. Exam trap: the exact mistake lecturers catch, and how to avoid it.
Plain text only. No asterisks, hashtags, emojis or markdown.`;

/** Writes one scheme-of-work lesson post and stores it in the shared library so every domain sees it. */
export const generatePost = createServerFn({ method: "POST" })
  .inputValidator((d: { level: string; course: string; code: string; courseTitle: string; topic: string }) => ({
    level: String(d.level).slice(0, 20), course: String(d.course).slice(0, 80), code: String(d.code).slice(0, 12),
    courseTitle: String(d.courseTitle).slice(0, 80), topic: String(d.topic).slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const none = { post: null as AIPost | null, id: null as string | null };
    const system = `You write lesson posts for FUTES Nexus, a study feed for Nigerian university students, following the NUC CCMAS scheme of work. The reader is a ${data.level} ${data.course} student who finds this topic hard. Stay strictly on the given course code and topic, but frame every picture, example and use-case around what a ${data.course} student will actually do in that career, so students of other departments taking the same course get a different angle.
${POST_RULES}
Reply ONLY with JSON: {"title": catchy title max 8 words, "hook": one sentence on why this matters in real life, "body": 150-220 words in 3 short paragraphs separated by \n\n (picture, plain rule, why it works), "steps": 3-5 short steps, "example": one worked example max 70 words, "trick": the memory hook, "trap": the exam mistake and the fix, "points": exactly 3 key points max 8 words each, "say": a 40-60 word spoken summary a friend would say out loud (picture, rule, hook)}.`;
    const raw = await chat(groqKeys(), process.env["CLEANAPIS_API_KEY"], [
      { role: "system", content: system },
      { role: "user", content: `${data.code} ${data.courseTitle} — topic: ${data.topic}` },
    ], { json: true, max: 1400 });
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

/** Practice quiz for one lesson, written by the Lovable AI Gateway. */
export const makeQuiz = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; code: string; body: string; level: string; difficulty: string }) => ({
    title: String(d.title).slice(0, 120), code: String(d.code).slice(0, 12), body: String(d.body).slice(0, 2000),
    level: String(d.level).slice(0, 20), difficulty: ["easy", "medium", "hard"].includes(d.difficulty) ? d.difficulty : "medium",
  }))
  .handler(async ({ data }) => {
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    const level = { easy: "simple recall of the main idea", medium: "a typical university test question that applies the idea", hard: "a tricky past-question style item built around the common exam trap" }[data.difficulty];
    try {
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: `You set practice questions for ${data.level} Nigerian university students. Write exactly 4 multiple-choice questions on the lesson. Difficulty: ${level}. Each has 4 short options and one correct answer. The explanation is 1-2 plain sentences saying why the answer is right and why the tempting wrong one is wrong. Plain text, no markdown. Reply ONLY with JSON: {"questions":[{"q":"...","options":["a","b","c","d"],"answer":0,"why":"..."}]}`,
        input: `${data.code}: ${data.title}\n\n${data.body}`,
      });
      let text = "";
      for (const item of res.output ?? []) {
        if (item.type === "message") for (const c of item.content) if (c.type === "output_text") text += c.text;
      }
      const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { questions?: QuizQ[] };
      const qs = (j.questions ?? []).filter((q) => q.q && Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === "number").slice(0, 5)
        .map((q) => ({ q: cleanText(q.q), options: q.options.map((o) => cleanText(String(o))).slice(0, 4), answer: Math.max(0, Math.min(3, q.answer)), why: cleanText(String(q.why ?? "")) }));
      return { questions: qs, error: qs.length ? null : "empty" };
    } catch (e) {
      if (e instanceof GatewayError) console.error("quiz", e.code, e.httpStatus);
      else console.error("quiz", e);
      const msg = e instanceof GatewayError && e.httpStatus === 429 ? "busy" : e instanceof GatewayError && e.httpStatus === 402 ? "credits" : "failed";
      return { questions: [] as QuizQ[], error: msg };
    }
  });

/** Phrases speech engines invent from silence; never sent to the chat box. */
export function isGhostTranscript(t: string): boolean {
  const s = t.toLowerCase().replace(/[^a-z ]/g, "").trim();
  return !s || /^(thank you|thanks|thank you for watching|bye|you|uh|um|hmm)( so much)?$/.test(s);
}

/** Speech-to-text: Deepgram Nova-3, then Nova-2. Never Groq. */
export const transcribe = createServerFn({ method: "POST" })
  .inputValidator((d: { audio: string; mime: string }) => ({ audio: String(d.audio ?? ""), mime: String(d.mime ?? "audio/webm") }))
  .handler(async ({ data }) => {
    const dg = process.env["DEEPGRAM_API_KEY"];
    if (!data.audio || !dg) return { text: null as string | null };
    const bin = atob(data.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length < 2000) return { text: null as string | null }; // too short to be speech
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
  .inputValidator((d: { text: string }) => ({ text: cleanText(String(d.text ?? "")).slice(0, 900) }))
  .handler(async ({ data }) => {
    const none = { audio: null as string | null, mime: "audio/mpeg" };
    if (!data.text) return none;
    const dg = process.env["DEEPGRAM_API_KEY"];
    if (dg) {
      for (const model of ["aura-2-thalia-en", "aura-2-andromeda-en", "aura-asteria-en"]) {
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
    try {
      const { EdgeTTS } = await import("edge-tts-universal");
      const tts = new EdgeTTS(data.text, "en-US-AvaMultilingualNeural");
      const r = await Promise.race([tts.synthesize(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("edge timeout")), 7000))]);
      return { audio: toB64(await r.audio.arrayBuffer()), mime: "audio/mpeg" };
    } catch (e) { console.error("edge tts", e); }
    return none;
  });
