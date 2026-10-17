import { createServerFn } from "@tanstack/react-start";

/** Natural female voice via Deepgram. Returns base64 mp3, or null if no key yet. */
export const speak = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string }) => ({ text: String(d.text ?? "").slice(0, 1200) }))
  .handler(async ({ data }) => {
    const key = process.env["DEEPGRAM_API_KEY"];
    if (!key || !data.text) return { audio: null as string | null };
    const res = await fetch("https://api.deepgram.com/v1/speak?model=aura-2-thalia-en", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.text }),
    });
    if (!res.ok) return { audio: null as string | null };
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { audio: btoa(bin) as string | null };
  });
