<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- All AI/voice server calls live in src/lib/ai.functions.ts: Groq key pool (GROQ_API_KEY.._5) → CleanAPIs fallback for text; TTS Deepgram Aura-2 → Microsoft Edge neural (never Groq). Offline voice is KittenTTS in src/lib/offline-voice.ts (never browser speechSynthesis). Why: one place for rate limits; user rejects robotic built-in voices.
- AI feed posts are generated one at a time by src/lib/feed-engine.ts, topics from src/lib/scheme.ts, stored in localStorage with a per-device daily cap. Why: stays within Groq limits and works offline.
- Simple Jarvis commands are matched locally before any AI call. Why: Groq free tier is ~20 req/min.
- AI lessons are also saved to the public `nexus_posts` table by the server (service role) and read back via server functions, so every domain shares one library without exposing write access. Why: localStorage is per-domain.
- Practice quizzes use the Groq key pool then CleanAPIs (`makeQuiz` in ai.functions.ts), never the Lovable gateway. Why: the Itoka/Vercel deploy has no gateway token.
- The PWA worker is written into dist/client (vite.config outDir) before Nitro packages static files. Why: every host, including Vercel/Itoka, then serves /sw.js.
