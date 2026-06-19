
-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  assistant_name TEXT NOT NULL DEFAULT 'ARIA',
  persona TEXT NOT NULL DEFAULT 'jarvis',
  system_prompt TEXT,
  voice_provider TEXT NOT NULL DEFAULT 'lovable',
  voice_id TEXT NOT NULL DEFAULT 'alloy',
  voice_speed NUMERIC NOT NULL DEFAULT 1.0,
  voice_instructions TEXT,
  spoken_replies BOOLEAN NOT NULL DEFAULT true,
  input_mode TEXT NOT NULL DEFAULT 'push_to_talk',
  verbosity INTEGER NOT NULL DEFAULT 50,
  formality INTEGER NOT NULL DEFAULT 50,
  default_chat_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  default_image_model TEXT NOT NULL DEFAULT 'openai/gpt-image-2',
  tools_enabled JSONB NOT NULL DEFAULT '{"web_search":true,"get_weather":true,"get_time":true,"calculate":true,"generate_image":true,"edit_image":true,"read_document":true,"remember":true,"recall":true,"create_reminder":true,"run_js":true}'::jsonb,
  avatar_style TEXT NOT NULL DEFAULT 'jarvis_orb',
  theme JSONB NOT NULL DEFAULT '{"preset":"stark","background":"#02060f","primary":"#22e1ff","accent":"#ffb547","alert":"#ff3b3b","glow":80,"scanline":true,"grid":true,"radius":12}'::jsonb,
  mood_colors JSONB NOT NULL DEFAULT '{"idle":"#22e1ff","listening":"#aef9ff","thinking":"#b070ff","speaking":"#ffb547","alert":"#ff3b3b","happy":"#ffc870","serious":"#3a7bff","playful":"#ff7fbf","concerned":"#ff8a3a"}'::jsonb,
  density TEXT NOT NULL DEFAULT 'comfortable',
  motion TEXT NOT NULL DEFAULT 'full',
  display_font TEXT NOT NULL DEFAULT 'Orbitron',
  body_font TEXT NOT NULL DEFAULT 'Rajdhani',
  mono_font TEXT NOT NULL DEFAULT 'JetBrains Mono',
  latitude NUMERIC,
  longitude NUMERIC,
  timezone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_owner" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- =========================================
-- updated_at helper
-- =========================================
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- Auto-create profile on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- THREADS
-- =========================================
CREATE TABLE public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  persona TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX threads_user_updated_idx ON public.threads(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "threads_owner" ON public.threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER threads_touch BEFORE UPDATE ON public.threads
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- MESSAGES (AI SDK UIMessage parts)
-- =========================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_sdk_id TEXT,
  mood TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_thread_created_idx ON public.messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_owner" ON public.messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- UPLOADS (user-attached files / photos)
-- =========================================
CREATE TABLE public.uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.threads(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'aria-uploads',
  storage_path TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  extracted_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX uploads_user_created_idx ON public.uploads(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uploads_owner" ON public.uploads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- GENERATIONS (AI-generated/edited images)
-- =========================================
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.threads(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  source_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  storage_bucket TEXT NOT NULL DEFAULT 'aria-images',
  storage_path TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX generations_user_created_idx ON public.generations(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generations TO authenticated;
GRANT ALL ON public.generations TO service_role;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "generations_owner" ON public.generations FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- REMINDERS
-- =========================================
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reminders_user_due_idx ON public.reminders(user_id, due_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminders TO authenticated;
GRANT ALL ON public.reminders TO service_role;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminders_owner" ON public.reminders FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =========================================
-- MEMORIES (long-term facts/summaries)
-- =========================================
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'fact',
  content TEXT NOT NULL,
  source_thread_id UUID REFERENCES public.threads(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX memories_user_created_idx ON public.memories(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;
GRANT ALL ON public.memories TO service_role;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memories_owner" ON public.memories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
