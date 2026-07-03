
ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS folder text,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS threads_user_folder_idx ON public.threads(user_id, folder);
CREATE INDEX IF NOT EXISTS threads_user_pinned_idx ON public.threads(user_id, pinned) WHERE pinned = true;
CREATE INDEX IF NOT EXISTS threads_title_search_idx ON public.threads USING gin (to_tsvector('english', coalesce(title, '')));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS voice_provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id text,
  ADD COLUMN IF NOT EXISTS elevenlabs_model text NOT NULL DEFAULT 'eleven_turbo_v2_5';
