import { createServerFn } from "@tanstack/react-start";

const toB64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

type Turn = { role: "user" | "assistant"; content: string };

/** Jarvis brain: Groq llama-3.1-8b-instant, short "senior coursemate" answers. */
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
    const key = process.env["GROQ_API_KEY"];
    if (!key) return { text: null as string | null, error: "missing_key" };
    const system = `You are Jarvis, a friendly senior coursemate at FUTES (Federal University of Technology and Environmental Sciences), Iyin-Ekiti, Nigeria. The student is ${data.level}, studying ${data.course}. Teach like talking to a struggling fresher: start with a simple everyday Nigerian-life analogy, then the plain rule in at most 3 short sentences, then one memory trick, then one exam trap if relevant. Keep the whole answer under 90 words. No markdown, no lists symbols, no jargon without explaining it. Stay within ${data.level} topics.`;
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          temperature: 0.5,
          max_tokens: 220,
          messages: [{ role: "system", content: system }, ...data.history, { role: "user", content: data.question }],
        }),
      });
      if (res.status === 429) return { text: null as string | null, error: "busy" };
      if (!res.ok) { console.error("groq chat", res.status, await res.text()); return { text: null as string | null, error: "failed" }; }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return { text: (j.choices?.[0]?.message?.content ?? "").trim() || null, error: null as string | null };
    } catch (e) { console.error(e); return { text: null as string | null, error: "failed" }; }
  });

/** Speech-to-text: Groq whisper-large-v3-turbo. Input is base64 audio. */
export const transcribe = createServerFn({ method: "POST" })
  .inputValidator((d: { audio: string; mime: string }) => ({ audio: String(d.audio ?? ""), mime: String(d.mime ?? "audio/webm") }))
  .handler(async ({ data }) => {
    const key = process.env["GROQ_API_KEY"];
    if (!key || !data.audio) return { text: null as string | null };
    try {
      const bin = atob(data.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const ext = data.mime.includes("mp4") ? "mp4" : data.mime.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("file", new Blob([bytes], { type: data.mime }), `speech.${ext}`);
      form.append("model", "whisper-large-v3-turbo");
      form.append("language", "en");
      const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
      if (!res.ok) { console.error("groq stt", res.status, await res.text()); return { text: null as string | null }; }
      const j = (await res.json()) as { text?: string };
      return { text: (j.text ?? "").trim() || null };
    } catch (e) { console.error(e); return { text: null as string | null }; }
  });

/** Text-to-speech: Groq Orpheus (hannah) first, Deepgram Aura as fallback. */
export const speak = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => ({ text: String(d.text ?? "").slice(0, 1000) }))
  .handler(async ({ data }) => {
    const none = { audio: null as string | null, mime: "audio/mpeg" };
    if (!data.text) return none;
    const groq = process.env["GROQ_API_KEY"];
    if (groq && data.text.length <= 200) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${groq}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "canopylabs/orpheus-v1-english", voice: "hannah", input: data.text, response_format: "wav" }),
        });
        if (res.ok) return { audio: toB64(await res.arrayBuffer()), mime: "audio/wav" };
        console.error("groq tts", res.status, await res.text());
      } catch (e) { console.error(e); }
    }
    const dg = process.env["DEEPGRAM_API_KEY"];
    if (!dg) return none;
    try {
      const res = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en", {
        method: "POST",
        headers: { Authorization: `Token ${dg}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text }),
      });
      if (!res.ok) { console.error("deepgram", res.status); return none; }
      return { audio: toB64(await res.arrayBuffer()), mime: "audio/mpeg" };
    } catch (e) { console.error(e); return none; }
  });
