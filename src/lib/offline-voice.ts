// KittenTTS (nano 0.8, voice "Bella") running on-device via WebAssembly. Browser-only: call from handlers/effects.
// Model, code and wasm are fetched once while online and kept by the service worker + Cache API for offline use.
type Kitten = { generate: (t: string, o: { voice: string }) => Promise<{ toAudioBuffer: (c: AudioContext) => AudioBuffer }> };
let ttsP: Promise<Kitten> | null = null;
let ctx: AudioContext | null = null;
let src: AudioBufferSourceNode | null = null;

const URL_ = "https://esm.sh/kitten-tts-js@0.1.2";

export function loadKitten(): Promise<Kitten> {
  if (!ttsP) {
    ttsP = import(/* @vite-ignore */ URL_)
      .then((m: { KittenTTS: { from_pretrained: (id: string) => Promise<Kitten> } }) => m.KittenTTS.from_pretrained("KittenML/kitten-tts-nano-0.8"))
      .catch((e) => { ttsP = null; throw e; });
  }
  return ttsP;
}

export const kittenReady = () => localStorage.getItem("nexus.kitten") === "1";

/** Download the offline voice in the background (only on Wi-Fi-ish / installed app). */
export async function warmKitten() {
  try { const t = await loadKitten(); await t.generate("Ready.", { voice: "Bella" }); localStorage.setItem("nexus.kitten", "1"); return true; }
  catch (e) { console.warn("offline voice not ready", e); return false; }
}

export function stopKitten() { try { src?.stop(); } catch { /* ignore */ } src = null; }

export async function speakOffline(text: string, onEnd?: () => void): Promise<boolean> {
  try {
    const t = await loadKitten();
    stopKitten();
    ctx ??= new AudioContext();
    const sentences = text.match(/[^.!?]+[.!?]*/g)?.slice(0, 12) ?? [text];
    let stopped = false;
    for (const s of sentences) {
      const a = await t.generate(s.trim(), { voice: "Bella" });
      if (stopped) break;
      await new Promise<void>((res) => {
        const node = ctx!.createBufferSource();
        node.buffer = a.toAudioBuffer(ctx!);
        node.connect(ctx!.destination);
        node.onended = () => { if (src !== node) stopped = true; res(); };
        src = node; node.start();
      });
      if (stopped) return true;
    }
    onEnd?.();
    return true;
  } catch (e) { console.warn(e); return false; }
}
