import { Drawer } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listThreads, createThread, deleteThread } from "@/lib/aria/threads.functions";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

export function ThreadDrawer({
  trigger,
  activeThreadId,
}: {
  trigger: ReactNode;
  activeThreadId?: string;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(listThreads);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      setOpen(false);
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threads"] }),
  });

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-[82vh] flex-col rounded-t-2xl border-t border-primary/30 bg-background outline-none">
          <Drawer.Title className="sr-only">Conversations</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-primary/40" />
          <div className="flex items-center justify-between px-5 py-3">
            <div className="font-display text-sm uppercase tracking-[0.3em] text-primary hud-text-glow">
              Conversations
            </div>
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="hud-corner flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-8">
            {threads.isLoading ? (
              <div className="px-3 py-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Loading…
              </div>
            ) : threads.data && threads.data.length > 0 ? (
              <ul className="space-y-1">
                {threads.data.map((t) => {
                  const isActive = t.id === activeThreadId;
                  return (
                    <li key={t.id} className="group flex items-stretch gap-1">
                      <button
                        onClick={() => {
                          setOpen(false);
                          navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
                        }}
                        className={`flex flex-1 min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                          isActive
                            ? "bg-primary/15 text-primary"
                            : "text-foreground/85 hover:bg-card"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="truncate text-sm">{t.title}</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Delete this conversation?")) {
                            deleteMut.mutate(t.id);
                            if (isActive) navigate({ to: "/chat", replace: true });
                          }
                        }}
                        className="rounded-lg border border-transparent px-3 text-muted-foreground hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-3 py-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                No conversations yet
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
