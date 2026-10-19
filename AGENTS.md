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
- All AI/voice calls live in src/lib/ai.functions.ts (Groq chat + Whisper STT, Groq Orpheus TTS with Deepgram fallback); keys read only inside handlers. Why: one place to manage rate limits and swap models.
- Simple Jarvis commands are matched locally before any AI call. Why: Groq free tier is ~20 req/min.
