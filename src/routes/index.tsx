import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { JarvisOrb } from "@/components/aria/JarvisOrb";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "motion/react";

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
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="relative z-10 min-h-screen overflow-hidden">
      {/* Top HUD bar */}
      <header className="flex items-center justify-between px-6 pt-6 sm:px-10">
        <div className="font-display text-sm uppercase tracking-[0.4em] text-primary hud-text-glow">
          A·R·I·A
        </div>
        <div className="hidden font-mono text-xs text-muted-foreground sm:flex sm:gap-6">
          <span>SYS · ONLINE</span>
          <span>{now ? `${now.toISOString().slice(11, 19)} UTC` : "--:--:-- UTC"}</span>
        </div>
        <Link
          to={authed ? "/chat" : "/auth"}
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-display text-xs uppercase tracking-widest text-primary transition hover:bg-primary/20"
        >
          {authed ? "Open" : "Sign In"}
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto mt-6 grid max-w-6xl gap-10 px-6 pb-24 sm:px-10 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-16 md:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-primary/70">
            Project / Personal AI
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[1.05] text-foreground sm:text-6xl md:text-7xl">
            Meet <span className="text-primary hud-text-glow">ARIA</span>.
            <br />
            Your own JARVIS.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            A holographic AI assistant that talks, listens, generates images, reads your documents, and
            remembers what matters — wrapped in an Iron-Man-style HUD you can theme to your taste.
          </p>

          <motion.ul
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } },
            }}
            className="mt-8 grid max-w-md grid-cols-2 gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground"
          >
            {[
              "Voice in / out",
              "JARVIS · FRIDAY · GIDEON",
              "Image generation",
              "Document analysis",
              "Long-term memory",
              "Mood-reactive HUD",
            ].map((f) => (
              <motion.li
                key={f}
                variants={{
                  hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
                  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
                }}
                className="rounded border border-primary/20 bg-card/40 px-2 py-1.5 text-primary/80 backdrop-blur-sm"
              >
                · {f}
              </motion.li>
            ))}
          </motion.ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate({ to: authed ? "/chat" : "/auth" })}
              className="hud-corner animate-hud-breathe rounded-md border border-primary bg-primary/15 px-6 py-3 font-display text-sm uppercase tracking-[0.3em] text-primary transition hover:bg-primary/25"
            >
              {authed ? "Resume Session" : "Initialize ARIA"}
            </motion.button>
            <a
              href="#features"
              className="rounded-md border border-border bg-card/60 px-6 py-3 font-display text-sm uppercase tracking-[0.3em] text-foreground backdrop-blur-sm transition hover:bg-secondary"
            >
              How it works
            </a>
          </div>
        </motion.div>

        {/* Orb */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative mx-auto grid place-items-center"
        >
          <JarvisOrb state="idle" size={360} />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 text-center font-mono text-[11px] uppercase tracking-[0.35em] text-primary/70"
          >
            Standby · Awaiting Command
          </motion.div>
        </motion.div>
      </section>


      {/* Feature grid */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24 sm:px-10">
        <div className="mb-8 font-display text-xs uppercase tracking-[0.4em] text-primary/70">
          /// Subsystems
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Holographic Avatar",
              body: "Switch between the JARVIS orb and a Gideon-style head. Colors shift with mood, state, and your custom theme.",
            },
            {
              title: "Real Voices",
              body: "Lovable AI voices by default, ElevenLabs character presets when connected, or clone your own voice and use it.",
            },
            {
              title: "Image Studio",
              body: "Generate art with streaming previews. Drop in a photo and ask ARIA to edit it. All saved privately to your library.",
            },
            {
              title: "Documents & Photos",
              body: "Upload PDFs, slides, spreadsheets, photos. ARIA reads, summarizes, answers questions, and can return edits.",
            },
            {
              title: "Long-term Memory",
              body: "ARIA remembers facts about you across conversations. View, edit, or wipe memories any time in Settings.",
            },
            {
              title: "Deep Customization",
              body: "Theme builder for every color, glow, and font. Editable personas. Bring your own OpenAI and ElevenLabs keys.",
            },
          ].map((f) => (
            <div key={f.title} className="hud-panel hud-corner rounded-lg p-5">
              <div className="font-display text-sm uppercase tracking-widest text-primary">
                {f.title}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-primary/15 px-6 py-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:px-10">
        ARIA v0.1 · Holographic personal assistant · Powered by Lovable AI
      </footer>
    </main>
  );
}
