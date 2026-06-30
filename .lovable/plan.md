# ARIA — Mobile-First Build Plan

Target device: phones (360–430px wide). Everything else (tablet/desktop) scales up gracefully, but every layout, tap target, and interaction is designed for one-thumb use first.

## Mobile-first ground rules

- Single-column layouts everywhere; no side rails on phone.
- Thread list, Studio library, Settings tabs → bottom sheets / drawers, not sidebars.
- Bottom tab bar for primary nav: **Chat · Studio · Library · Settings**.
- Composer docked above the tab bar, safe-area aware (`env(safe-area-inset-bottom)`).
- Min tap target 44px; orb + voice button are the largest controls.
- Avatars (orb / Gideon head) sized to ~55% of viewport width, sit above messages on empty state, shrink to a 36px header chip during conversation.
- Haptics on send / voice start-stop / mood change (`navigator.vibrate`).
- Sheets use `vaul` Drawer; settings use stacked accordion sections, not 4 side-by-side tabs.

## Build order (mobile-first)

1. **Mobile shell** — bottom tab bar, safe-area layout, route group `_authenticated/(tabs)`, swap current chat header for a compact mobile HUD frame with corner ticks + scanline.
2. **Voice (listen + speak)** — big mic FAB in composer. STT via Lovable AI `openai/gpt-4o-mini-transcribe` streaming. TTS via Lovable AI default; persona → voice mapping. Auto-play assistant replies when voice mode is on. Visualizer ring around the orb driven by mic RMS.
3. **ElevenLabs voices (BYOK)** — Settings → Voice: paste key (stored via add_secret), pick from JARVIS/FRIDAY/GIDEON/KAREN character presets + Voice Library search + upload-to-clone. Server route `/api/tts/elevenlabs`.
4. **OpenAI BYOK** — Settings → Integrations: paste key. Unlocks OpenAI TTS voices + GPT-image in Studio + GPT chat models in the model picker.
5. **Holographic avatars** — upgrade `JarvisOrb` (already SVG) with extra rings + particle motes; add `GideonHead` (react-three-fiber low-poly wireframe head, lip-sync to TTS audio analyser). Avatar picker in Settings: Orb / Gideon Head / Minimal Dot. Mood → CSS HSL var interpolation over 600ms; 9 user-overridable colors.
6. **Uploads (docs + photos)** — `aria-uploads` bucket with RLS. Composer: 📎 button → camera / photo library / file. Images sent as `image_url` to Gemini for vision. PDF/DOCX/XLSX parsed server-side, text injected. Per-file 20 MB, max 5 on mobile.
7. **Studio (image gen + edit)** — `/studio` mobile page: prompt sheet, model picker, size presets (1:1, 9:16, 16:9), streaming partial previews via `openai/gpt-image-2`. Tap an image → edit sheet (mask-free prompt edit). Saved to `generations` + `aria-images`.
8. **Library** — grid of past generations + uploads, long-press to share/download/delete.
9. **Threads as bottom sheet** — pull-down from top of chat opens thread list; new thread FAB.
10. **Memory + daily briefing** — `memories` table writes when user says "remember…"; morning briefing card on Chat tab if profile has lat/lon/tz.
11. **"Unlimited credits" workaround** — Settings banner explains the cap, with one-tap deep links to add OpenAI / ElevenLabs keys; usage meter shows Lovable AI consumption.
12. **Polish** — pull-to-refresh on thread list, swipe-to-delete messages, share-sheet export of a thread as markdown, PWA manifest so it installs to home screen with the ARIA icon.

## Technical notes

- Routes: `src/routes/_authenticated/(tabs)/{chat,studio,library,settings}.tsx` + tab layout file with `<Outlet />` and bottom nav.
- Server routes: `src/routes/api/{tts/lovable,tts/elevenlabs,tts/openai,stt,upload,generate-image,edit-image}.ts`.
- Server functions in `src/lib/aria/*.functions.ts`: `listUploads`, `deleteUpload`, `listGenerations`, `searchMemories`, `dailyBriefing`.
- Storage buckets: `aria-uploads`, `aria-images`, `aria-voice-samples` (all private, RLS by `auth.uid()` prefix).
- Tables to add: `generations`, `uploads` if not yet present; extend `profiles` with `voice_provider`, `voice_id`, `avatar_style`, `mood_colors jsonb`, `lat`, `lon`.
- Secrets requested via `add_secret` only after user confirms: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`.
- PWA: manifest-only (installable, no offline), per Lovable PWA skill.

## Deferred

Real celebrity voice cloning, wake-word always-listening, calendar/email/Slack integrations, multi-user sharing, video generation.

Approve to start with **step 1 (mobile shell)** and **step 2 (voice)** in the same pass.
