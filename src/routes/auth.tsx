import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { JarvisOrb } from "@/components/aria/JarvisOrb";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ARIA" },
      { name: "description", content: "Sign in or create an account to access ARIA." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat" });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Initializing ARIA…");
        navigate({ to: "/chat" });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Reset link sent. Check your inbox.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/chat" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/chat" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative z-10 grid min-h-screen place-items-center px-4">
      <div className="grid w-full max-w-5xl gap-12 md:grid-cols-[1fr_1fr] md:items-center">
        <div className="hidden flex-col items-center justify-center md:flex">
          <JarvisOrb state="listening" size={300} />
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.4em] text-primary/70">
            Awaiting Identity Verification
          </p>
        </div>

        <div className="hud-panel hud-corner mx-auto w-full max-w-md rounded-lg p-8">
          <Link
            to="/"
            className="font-display text-xs uppercase tracking-[0.4em] text-primary/70 hover:text-primary"
          >
            ← ARIA
          </Link>
          <h1 className="mt-4 font-display text-2xl uppercase tracking-widest text-primary hud-text-glow">
            {mode === "signup"
              ? "Create Identity"
              : mode === "forgot"
                ? "Recover Access"
                : "Identify Yourself"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Provision a new ARIA profile in seconds."
              : mode === "forgot"
                ? "Enter your email and we'll send a secure reset link."
                : "Resume your session and pick up where you left off."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-primary/70">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded border border-primary/30 bg-background/60 px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="you@example.com"
              />
            </div>
            {mode !== "forgot" && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-primary/70">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="font-mono text-[10px] uppercase tracking-widest text-primary/70 hover:text-primary"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded border border-primary/30 bg-background/60 px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
                  placeholder="••••••••"
                />
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="hud-corner w-full rounded border border-primary bg-primary/15 px-4 py-2.5 font-display text-sm uppercase tracking-[0.3em] text-primary transition hover:bg-primary/25 disabled:opacity-50 hud-glow"
            >
              {loading
                ? "…"
                : mode === "signup"
                  ? "Initialize"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Sign In"}
            </button>
          </form>

          {mode !== "forgot" && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-primary/20" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  or
                </span>
                <div className="h-px flex-1 bg-primary/20" />
              </div>

              <button
                onClick={handleGoogle}
                disabled={loading}
                className="w-full rounded border border-border bg-card px-4 py-2.5 font-display text-sm uppercase tracking-[0.3em] text-foreground transition hover:bg-secondary disabled:opacity-50"
              >
                Continue with Google
              </button>
            </>
          )}

          <button
            onClick={() =>
              setMode(mode === "signin" ? "signup" : mode === "signup" ? "signin" : "signin")
            }
            className="mt-6 w-full font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            {mode === "signin"
              ? "No account? Provision a new identity →"
              : mode === "signup"
                ? "← Already have an account? Sign in"
                : "← Back to sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
