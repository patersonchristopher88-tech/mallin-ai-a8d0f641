import { createFileRoute, Outlet, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread, deleteThread } from "@/lib/aria/threads.functions";
import { getProfile } from "@/lib/aria/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { JarvisOrb } from "@/components/aria/JarvisOrb";
import { Plus, MessageSquare, Trash2, Settings, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const profileFn = useServerFn(getProfile);

  const params = useParams({ strict: false });
  const activeThreadId = (params as { threadId?: string }).threadId;

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const threads = useQuery({ queryKey: ["threads"], queryFn: () => listFn() });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
  });

  // Auto-redirect from /chat to newest thread, or create one if none.
  useEffect(() => {
    if (activeThreadId) return;
    if (threads.isLoading || !threads.data) return;
    if (threads.data.length > 0) {
      navigate({ to: "/chat/$threadId", params: { threadId: threads.data[0].id }, replace: true });
    } else {
      createMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads.data, activeThreadId]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    toast.success("Signed out");
  }

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="relative z-10 grid min-h-screen md:grid-cols-[280px_1fr]">
      {/* Thread rail */}
      <aside
        className={`${collapsed ? "hidden" : "flex"} md:flex flex-col border-r border-primary/15 bg-card/40 backdrop-blur`}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="font-display text-xs uppercase tracking-[0.4em] text-primary hud-text-glow"
          >
            A·R·I·A
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            v0.1
          </div>
        </div>

        <div className="px-3">
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="hud-corner flex w-full items-center justify-center gap-2 rounded border border-primary/40 bg-primary/10 px-3 py-2 font-display text-xs uppercase tracking-widest text-primary transition hover:bg-primary/20 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> New Conversation
          </button>
        </div>

        <nav className="mt-3 flex-1 overflow-y-auto px-2">
          {threads.isLoading ? (
            <div className="px-3 py-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Loading threads…
            </div>
          ) : threads.data && threads.data.length > 0 ? (
            <ul className="space-y-1">
              {threads.data.map((t) => {
                const isActive = t.id === activeThreadId;
                return (
                  <li key={t.id} className="group relative">
                    <Link
                      to="/chat/$threadId"
                      params={{ threadId: t.id }}
                      className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition ${
                        isActive
                          ? "bg-primary/20 text-primary"
                          : "text-foreground/80 hover:bg-card hover:text-foreground"
                      }`}
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="truncate">{t.title}</span>
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm("Delete this conversation?")) {
                          deleteMut.mutate(t.id);
                          if (isActive) navigate({ to: "/chat", replace: true });
                        }
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-3 py-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              No threads yet
            </div>
          )}
        </nav>

        <div className="border-t border-primary/15 p-3">
          <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Identity
          </div>
          <div className="mb-2 truncate px-1 text-sm text-foreground">
            {profile.data?.display_name || profile.data?.email || "Operator"}
          </div>
          <div className="flex gap-1.5">
            <Link
              to="/settings"
              className="flex flex-1 items-center justify-center gap-1.5 rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground/80 hover:bg-secondary"
            >
              <Settings className="h-3 w-3" />
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-1.5 rounded border border-border bg-card px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-foreground/80 hover:bg-destructive/20 hover:text-destructive"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        </div>
      </aside>

      <main className="relative flex min-h-screen flex-col">
        {!activeThreadId && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <JarvisOrb state="idle" size={220} />
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.4em] text-primary/70">
                Initializing…
              </p>
            </div>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
