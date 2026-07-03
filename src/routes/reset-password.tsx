import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { JarvisOrb } from "@/components/aria/JarvisOrb";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — ARIA" },
      { name: "description", content: "Set a new password for your ARIA account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase will parse ?code= / #access_token= and fire PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also treat existing session as valid entry.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. Signing you in…");
      navigate({ to: "/chat" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative z-10 grid min-h-screen place-items-center px-4">
      <div className="hud-panel hud-corner w-full max-w-md rounded-lg p-8">
        <div className="mb-4 flex items-center gap-3">
          <JarvisOrb state="idle" size={56} />
          <div>
            <Link
              to="/auth"
              className="font-display text-[10px] uppercase tracking-[0.4em] text-primary/70 hover:text-primary"
            >
              ← Sign in
            </Link>
            <h1 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
              New Credentials
            </h1>
          </div>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground">
            Verifying reset link… If this hangs, request a new reset email from the sign-in page.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-primary/70">
                New password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-primary/30 bg-background/60 px-3 py-2.5 text-foreground focus:border-primary focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-primary/70">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded border border-primary/30 bg-background/60 px-3 py-2.5 text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="hud-corner w-full rounded border border-primary bg-primary/15 px-4 py-2.5 font-display text-sm uppercase tracking-[0.3em] text-primary transition hover:bg-primary/25 disabled:opacity-50"
            >
              {loading ? "…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
