
-- Spotify tokens (per-user OAuth)
CREATE TABLE public.spotify_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spotify_tokens TO authenticated;
GRANT ALL ON public.spotify_tokens TO service_role;
ALTER TABLE public.spotify_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tokens" ON public.spotify_tokens FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER spotify_tokens_touch BEFORE UPDATE ON public.spotify_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Per-thread model & persona overrides
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS persona TEXT;

-- Profile extensions for theme/personas/hud
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_personas JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hud_widgets JSONB NOT NULL DEFAULT '{"clock":true,"weather":true,"spotify":true,"system":true}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wake_word_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS voice_provider TEXT NOT NULL DEFAULT 'lovable';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS elevenlabs_voice_id TEXT;
