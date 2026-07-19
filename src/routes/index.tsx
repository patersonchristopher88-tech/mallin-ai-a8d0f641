import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { JarvisOrb } from "@/components/aria/JarvisOrb";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "motion/react";
import { ArrowRight, Brain, Camera, Compass, Mic, Sparkles, Star, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ARIA — your personal AI assistant" },
      {
        name: "description",
        content:
          "Talk, generate images, upload documents, customize everything. A holographic AI assistant inspired by JARVIS, FRIDAY, and Gideon.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => new Date());

  const greeting = useMemo(() => {
    const hour = now.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, [now]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="relative z-10 min-h-screen overflow-hidden">
      <header className="flex items-center justify-between px-6 pt-6 sm:px-10">
        <div className="font-display text-sm uppercase tracking-[0.4em] text-primary hud-text-glow">
          A·R·I·A
        </div>
        <div className="hidden font-mono text-xs text-muted-foreground sm:flex sm:gap-6">
          <span>SYS · ONLINE</span>
          <span>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <Link
          to={authed ? "/chat" : "/auth"}
          className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-primary transition hover:bg-primary/20"
        >
          {authed ? "Open" : "Sign In"}
        </Link>
      </header>

      <section className="mx-auto mt-6 grid max-w-6xl gap-8 px-6 pb-20 sm:px-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-10 md:pt-8">
        <motion.div
          initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
          className="hud-panel hud-corner rounded-[28px] p-6 sm:p-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.35em] text-primary/80">
            <Sparkles className="h-3.5 w-3.5" /> Ascend Assistant v2.0
          </div>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] text-foreground sm:text-5xl md:text-6xl">
            {greeting}, <span className="text-primary hud-text-glow">you’re ready</span>.
            <br />
            Premium AI, instantly.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
            ARIA now feels like a true modern copilot: faster chats, richer media, voice workflows, memory, and polished studio tools in one cohesive experience.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate({ to: authed ? "/chat" : "/auth" })}
              className="hud-corner animate-hud-breathe rounded-full border border-primary bg-primary/15 px-5 py-3 font-display text-sm uppercase tracking-[0.3em] text-primary transition hover:bg-primary/25"
            >
              {authed ? "Resume Session" : "Launch ARIA"}
            </motion.button>
            <Link
              to="/studio"
              className="rounded-full border border-border bg-card/70 px-5 py-3 font-display text-sm uppercase tracking-[0.3em] text-foreground backdrop-blur-sm transition hover:bg-secondary"
            >
              Explore Studio
            </Link>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { title: "Quick actions", body: "Jump into chat, studio, vision, and projects in one tap.", icon: Zap },
              { title: "Memory aware", body: "ARIA remembers what matters with your permission and keeps it tidy.", icon: Brain },
              { title: "Vision ready", body: "Scan documents, QR codes, objects, and more in a premium camera experience.", icon: Camera },
              { title: "Voice-first", body: "Speak naturally and let the assistant respond with rich voice playback.", icon: Mic },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-primary/20 bg-background/60 p-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Icon className="h-4 w-4" />
                    <span className="font-display text-[11px] uppercase tracking-[0.25em]">{item.title}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="hud-panel hud-corner rounded-[32px] p-5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.35em] text-primary/70">
              <span>Daily briefing</span>
              <span>{now.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
            </div>
            <div className="mt-4 grid place-items-center">
              <JarvisOrb state="idle" size={260} />
            </div>
            <div className="mt-4 rounded-2xl border border-primary/15 bg-background/60 p-4">
              <div className="flex items-center justify-between">
                <div className="font-display text-sm uppercase tracking-[0.25em] text-primary">Your hub</div>
                <div className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">Live</div>
              </div>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between rounded-lg border border-primary/10 bg-card/50 px-3 py-2">
                  <span>Continue last chat</span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-primary/10 bg-card/50 px-3 py-2">
                  <span>Open Studio workspace</span>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-primary/10 bg-card/50 px-3 py-2">
                  <span>Scan with Vision</span>
                  <Camera className="h-4 w-4 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <div className="font-display text-xs uppercase tracking-[0.4em] text-primary/70">
            /// premium capabilities
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-primary/20 bg-card/60 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:flex">
            <Compass className="h-3.5 w-3.5" /> Polished navigation
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Holographic Avatar",
              body: "Switch between personalities, moods, and themes without losing the coherent HUD experience.",
            },
            {
              title: "Studio Workspace",
              body: "Image, video, audio, writing, dev, design, and productivity tools all live in one elegant hub.",
            },
            {
              title: "Vision Pro",
              body: "OCR, QR scanning, document capture, object recognition, and follow-up questions are all built in.",
            },
            {
              title: "Persistent Memory",
              body: "ARIA remembers what you want remembered, and you can view, edit, or disable memory any time.",
            },
            {
              title: "Voice-first UX",
              body: "Tap to talk, hear responses, and stay hands-free while getting work done.",
            },
            {
              title: "Premium Design",
              body: "Glassy panels, rounded corners, motion, and responsive spacing make the app feel state-of-the-art.",
            },
          ].map((f) => (
            <div key={f.title} className="hud-panel hud-corner rounded-2xl p-5">
              <div className="font-display text-sm uppercase tracking-widest text-primary">
                {f.title}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-primary/15 px-6 py-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:px-10">
        ARIA v2.0 · Premium assistant workspace · Powered by Lovable AI
      </footer>
    </main>
  );
}
