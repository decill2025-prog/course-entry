import { createServerFn } from "@tanstack/react-start";

const toB64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

type Turn = { role: "user" | "assistant"; content: string };
type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

// Rotates through up to 5 Groq keys; on 429/5xx moves to the next key, then falls back to CleanAPIs.
let cursor = 0;
async function chat(keys: string[], clean: string | undefined, messages: ChatMsg[], opts: { json?: boolean; max?: number } = {}): Promise<string | null> {
  const n = keys.length;
  for (let i = 0; i < n; i++) {
    const key = keys[(cursor + i) % n]!;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b", reasoning_effort: "low", temperature: 0.6, max_tokens: opts.max ?? 700, messages,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (res.ok) {
        cursor = (cursor + i + 1) % n;
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const t = (j.choices?.[0]?.message?.content ?? "").trim();
        if (t) return t;
      } else console.error("groq", res.status);
    } catch (e) { console.error("groq err", e); }
  }
  if (!clean) return null;
  for (const model of ["deepseek-v4-flash-0731", "gemini-3.6-flash"]) {
    try {
      const res = await fetch("https://cleanapis.com/v1/chat/completions", {
        method: "POST",
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
    const system = `You are Nexus, a friendly senior coursemate at FUTES (Federal University of Technology and Environmental Sciences), Iyin-Ekiti, Nigeria. The student is ${data.level}, studying ${data.course}. Teach like talking to a struggling fresher: start with a simple everyday Nigerian-life example, then the plain rule in at most 3 short sentences, then one memory trick, then one exam trap if relevant. Keep the whole answer under 90 words. No markdown, no list symbols, no jargon without explaining it.`;
    const text = await chat(groqKeys(), process.env["CLEANAPIS_API_KEY"], [{ role: "system", content: system }, ...data.history, { role: "user", content: data.question }]);
    return { text, error: text ? null : "busy" };
  });

export type AIPost = { title: string; hook: string; body: string; steps: string[]; example: string; trick: string; trap: string; points: string[] };

/** Writes one scheme-of-work lesson post. Called one at a time by the client queue. */
export const generatePost = createServerFn({ method: "POST" })
  .inputValidator((d: { level: string; course: string; code: string; courseTitle: string; topic: string }) => ({
    level: String(d.level).slice(0, 20), course: String(d.course).slice(0, 80), code: String(d.code).slice(0, 12),
    courseTitle: String(d.courseTitle).slice(0, 80), topic: String(d.topic).slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const system = `You write lesson posts for FUTES Nexus, a study feed for Nigerian university students. Follow the NUC CCMAS scheme of work. Write for a ${data.level} ${data.course} student who finds the topic hard. Use simple English, Nigerian everyday examples (danfo, suya, NEPA light, market, Iyin-Ekiti campus), and explain WHY, not just what. Reply ONLY with JSON: {"title": short catchy title (max 8 words), "hook": one sentence that makes them want to read, "body": 150-220 word plain explanation in 2-3 short paragraphs separated by \\n\\n, "steps": 3-5 short step-by-step strings, "example": one worked example or real-life case (max 70 words), "trick": one memorable mnemonic, "trap": the most common exam mistake and how to avoid it, "points": exactly 3 key points to remember (max 8 words each)}. No markdown.`;
    const raw = await chat(groqKeys(), process.env["CLEANAPIS_API_KEY"], [
      { role: "system", content: system },
      { role: "user", content: `${data.code} ${data.courseTitle} — topic: ${data.topic}` },
    ], { json: true, max: 1400 });
    if (!raw) return { post: null as AIPost | null };
    try {
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Partial<AIPost>;
      const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).slice(0, 6) : []);
      if (!j.title || !j.body) return { post: null as AIPost | null };
      return { post: { title: String(j.title), hook: String(j.hook ?? ""), body: String(j.body), steps: arr(j.steps), example: String(j.example ?? ""), trick: String(j.trick ?? ""), trap: String(j.trap ?? ""), points: arr(j.points) } as AIPost | null };
    } catch { return { post: null as AIPost | null }; }
  });

/** Speech-to-text: Groq whisper-large-v3-turbo with key rotation. */
export const transcribe = createServerFn({ method: "POST" })
  .inputValidator((d: { audio: string; mime: string }) => ({ audio: String(d.audio ?? ""), mime: String(d.mime ?? "audio/webm") }))
  .handler(async ({ data }) => {
    if (!data.audio) return { text: null as string | null };
    const bin = atob(data.audio);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = data.mime.includes("mp4") ? "mp4" : data.mime.includes("ogg") ? "ogg" : "webm";
    for (const key of groqKeys()) {
      try {
        const form = new FormData();
        form.append("file", new Blob([bytes], { type: data.mime }), `speech.${ext}`);
        form.append("model", "whisper-large-v3-turbo");
        form.append("language", "en");
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
        if (!res.ok) { console.error("groq stt", res.status); continue; }
        const j = (await res.json()) as { text?: string };
        return { text: (j.text ?? "").trim() || null };
      } catch (e) { console.error(e); }
    }
    return { text: null as string | null };
  });

/** Text-to-speech: Groq Orpheus → Microsoft neural (Edge) → Deepgram Aura. */
export const speak = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => ({ text: String(d.text ?? "").slice(0, 1500) }))
  .handler(async ({ data }) => {
    const none = { audio: null as string | null, mime: "audio/mpeg" };
    if (!data.text) return none;
    if (data.text.length <= 200) {
      for (const key of groqKeys().slice(0, 2)) {
        try {
          const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "canopylabs/orpheus-v1-english", voice: "hannah", input: data.text, response_format: "wav" }),
          });
          if (res.ok) return { audio: toB64(await res.arrayBuffer()), mime: "audio/wav" };
          console.error("groq tts", res.status);
        } catch (e) { console.error(e); }
      }
    }
    try {
      const { EdgeTTS } = await import("edge-tts-universal");
      const tts = new EdgeTTS(data.text, "en-US-AvaMultilingualNeural");
      const r = await Promise.race([tts.synthesize(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("edge timeout")), 8000))]);
      return { audio: toB64(await r.audio.arrayBuffer()), mime: "audio/mpeg" };
    } catch (e) { console.error("edge tts", e); }
    const dg = process.env["DEEPGRAM_API_KEY"];
    if (!dg) return none;
    try {
      const res = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en", {
        method: "POST",
        headers: { Authorization: `Token ${dg}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text.slice(0, 1900) }),
      });
      if (!res.ok) { console.error("deepgram", res.status); return none; }
      return { audio: toB64(await res.arrayBuffer()), mime: "audio/mpeg" };
    } catch (e) { console.error(e); return none; }
  });
