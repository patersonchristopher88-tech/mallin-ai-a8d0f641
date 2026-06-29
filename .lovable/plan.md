# ARIA v3 — "A Million Times Better"

Locking in Spotify, real voice, working uploads, customization, tools, memory, multi-model, live HUD widgets. Built in two waves so you can try it as it lands.

## Wave 1 — Foundations + visible wins (this turn)

### A. Uploads that actually work
- New `Composer` component with **drag-and-drop**, paste-to-attach, file picker
- **Live upload progress** (per-file rings) + thumbnail previews for images, icon chips for docs
- Bigger types: images, PDFs, DOCX, TXT, MD, CSV, JSON, code
- Images go straight into the model as vision parts; docs are parsed server-side (`pdf-parse`, `mammoth`) and injected as text context
- Long-press / X to remove an attachment before sending

### B. Real voice (ElevenLabs)
- Connect ElevenLabs via the standard connector (uses your linked account, no key pasting)
- **TTS**: `/api/tts/elevenlabs.ts` — character preset map (JARVIS = `George`, FRIDAY = `Sarah`, GIDEON = `Adam`, KAREN = `Matilda`, plus 10 more)
- **STT**: keep Lovable AI `gpt-4o-mini-transcribe` (already works, free) as default, ElevenLabs Scribe optional
- **Continuous conversation mode**: tap orb → mic stays open, VAD auto-commits, ARIA replies and speaks, loops until you tap again
- Wake-word ("Hey ARIA") toggle using the Web Speech API as a free always-on listener that hands off to real STT when triggered

### C. Spotify (BYOK)
- Settings → **Connections** card with "Connect Spotify" button
- You add `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` via the secret prompt
- OAuth flow at `/api/public/spotify/callback` (PKCE), tokens stored in new `spotify_tokens` table (RLS scoped to user)
- **Now-Playing HUD widget** on chat screen: album art, track, artist, scrubber, prev/play/pause/next
- ARIA tool calls: `spotify_search`, `spotify_play`, `spotify_pause`, `spotify_next`, `spotify_queue`, `spotify_now_playing` — so you can just say "play Daft Punk"

### D. Tools / function-calling
- Add tools array to `/api/chat.ts` using Gemini/GPT-5 function calling
- Built-in tools: `web_search` (Lovable AI built-in), `get_weather` (open-meteo, no key), `get_time`, `create_reminder`, `save_memory`, `recall_memory`, plus the Spotify ones above
- Tool calls render as collapsible HUD cards in the chat ("⚡ Searching the web…" → result)

### E. Multi-model routing
- Per-thread model picker (chip in chat header): Gemini 3 Flash / 2.5 Pro / GPT-5 / GPT-5 mini / Claude Sonnet 4.5
- **Auto mode**: classifier picks Flash for chat, Pro/GPT-5 for reasoning, image model for "draw me…"
- Persisted on the thread row

## Wave 2 — Customization + HUD widgets (next turn)

### F. Full theme builder
- Settings → Appearance: color pickers for primary / accent / alert / glow / background, scanline density, grid opacity, vignette, mood-color editor (9 swatches), font picker (Orbitron / Rajdhani / Exo 2 / Share Tech Mono / custom), corner-bracket style, radius, motion level
- Live preview orb beside the controls
- "Export theme" → JSON, "Import theme" → paste

### G. Persona studio
- Edit any persona's name, tagline, system prompt, voice, default model, accent color
- Create unlimited custom personas, switch per-thread

### H. Live HUD widgets (chat overlay)
- Top strip: time + date, weather (geolocated), CPU-style "system load" (made of real client metrics: FPS, memory, network), Spotify mini-bar
- Toggleable per-widget in Settings → HUD
- All widgets respect mood color

### I. Memory system
- `memories` table (already exists) wired to `save_memory` / `recall_memory` tools
- Settings → Memory tab: searchable list, edit, delete, pin
- Auto-extraction toggle: after each turn, a lightweight classifier asks "is there a durable fact about the user worth remembering?"

## Technical notes

- **Schema**: add `spotify_tokens(user_id, access_token, refresh_token, expires_at, scope)`, add `thread.model` and `thread.persona` columns, add `profiles.theme jsonb`, `profiles.custom_personas jsonb`, `profiles.hud_widgets jsonb`
- **Server fns**: `spotify.functions.ts` (auth + control), `tools.server.ts` (tool dispatcher), `memory.functions.ts`
- **Routes**: `/api/public/spotify/callback`, `/api/tts/elevenlabs`, `/api/tools/[name]` for tool execution
- **Composer**: extract from `chat.$threadId.tsx` into `src/components/aria/Composer.tsx` with `useDropzone` (react-dropzone)
- **Voice loop**: new `useVoiceConversation` hook orchestrating mic → STT → chat → TTS → playback → mic
- **Secrets needed from you**: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (Spotify dashboard → Create app → redirect URI: `https://<your-preview-url>/api/public/spotify/callback`). ElevenLabs comes through the connector flow, no paste.

Approve and I'll start Wave 1 — uploads + voice + Spotify scaffolding first, then tools + multi-model.