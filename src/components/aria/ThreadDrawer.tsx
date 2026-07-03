import { Drawer } from "vaul";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listThreads,
  listFolders,
  createThread,
  deleteThread,
  toggleThreadPin,
  updateThreadFolder,
  renameThread,
} from "@/lib/aria/threads.functions";
import {
  MessageSquare,
  Plus,
  Trash2,
  Search,
  Pin,
  PinOff,
  FolderPlus,
  Folder,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { useState, useMemo, type ReactNode } from "react";

export function ThreadDrawer({
  trigger,
  activeThreadId,
}: {
  trigger: ReactNode;
  activeThreadId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | "all">("all");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listThreads);
  const foldersFn = useServerFn(listFolders);
  const createFn = useServerFn(createThread);
  const deleteFn = useServerFn(deleteThread);
  const pinFn = useServerFn(toggleThreadPin);
  const folderFn = useServerFn(updateThreadFolder);
  const renameFn = useServerFn(renameThread);

  const threads = useQuery({
    queryKey: ["threads", query, folderFilter],
    queryFn: () =>
      listFn({
        data: {
          search: query || undefined,
          folder: folderFilter === "all" ? undefined : folderFilter,
        },
      }),
    enabled: open,
  });

  const folders = useQuery({
    queryKey: ["thread-folders"],
    queryFn: () => foldersFn(),
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createFn({
        data: { folder: folderFilter === "all" ? null : folderFilter },
      }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["thread-folders"] });
      setOpen(false);
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["threads"] });
    qc.invalidateQueries({ queryKey: ["thread-folders"] });
  };
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: invalidate,
  });
  const pinMut = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => pinFn({ data: v }),
    onSuccess: invalidate,
  });
  const folderMut = useMutation({
    mutationFn: (v: { id: string; folder: string | null }) => folderFn({ data: v }),
    onSuccess: invalidate,
  });
  const renameMut = useMutation({
    mutationFn: (v: { id: string; title: string }) => renameFn({ data: v }),
    onSuccess: invalidate,
  });

  const grouped = useMemo(() => {
    const list = threads.data ?? [];
    const pinned = list.filter((t) => t.pinned);
    const rest = list.filter((t) => !t.pinned);
    return { pinned, rest };
  }, [threads.data]);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex h-[88vh] flex-col rounded-t-2xl border-t border-primary/30 bg-background outline-none">
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

          {/* Search */}
          <div className="px-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations…"
                className="w-full rounded-lg border border-primary/25 bg-card/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Folder chips */}
          <div className="mt-3 flex flex-wrap gap-1.5 overflow-x-auto px-4 pb-2">
            <FolderChip
              active={folderFilter === "all"}
              label="All"
              onClick={() => setFolderFilter("all")}
            />
            {(folders.data ?? []).map((f) => (
              <FolderChip
                key={f}
                active={folderFilter === f}
                label={f}
                onClick={() => setFolderFilter(f)}
              />
            ))}
            <button
              onClick={() => {
                const name = prompt("New folder name")?.trim();
                if (!name) return;
                setFolderFilter(name);
              }}
              className="flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-primary/70 hover:bg-primary/10"
            >
              <FolderPlus className="h-3 w-3" /> New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-8">
            {threads.isLoading ? (
              <div className="px-3 py-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Loading…
              </div>
            ) : (threads.data?.length ?? 0) > 0 ? (
              <>
                {grouped.pinned.length > 0 && (
                  <Section label="Pinned">
                    {grouped.pinned.map((t) => (
                      <ThreadRow
                        key={t.id}
                        t={t}
                        active={t.id === activeThreadId}
                        menuOpen={menuFor === t.id}
                        onMenu={(v) => setMenuFor(v ? t.id : null)}
                        onOpen={() => {
                          setOpen(false);
                          navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
                        }}
                        onDelete={() => {
                          if (confirm("Delete this conversation?")) {
                            deleteMut.mutate(t.id);
                            if (t.id === activeThreadId) navigate({ to: "/chat", replace: true });
                          }
                        }}
                        onPin={() => pinMut.mutate({ id: t.id, pinned: !t.pinned })}
                        onFolder={() => {
                          const cur = t.folder ?? "";
                          const name = prompt("Move to folder (blank = none)", cur);
                          if (name === null) return;
                          folderMut.mutate({ id: t.id, folder: name.trim() || null });
                        }}
                        onRename={() => {
                          const name = prompt("Rename conversation", t.title)?.trim();
                          if (!name) return;
                          renameMut.mutate({ id: t.id, title: name });
                        }}
                      />
                    ))}
                  </Section>
                )}
                {grouped.rest.length > 0 && (
                  <Section label={grouped.pinned.length > 0 ? "Recent" : undefined}>
                    {grouped.rest.map((t) => (
                      <ThreadRow
                        key={t.id}
                        t={t}
                        active={t.id === activeThreadId}
                        menuOpen={menuFor === t.id}
                        onMenu={(v) => setMenuFor(v ? t.id : null)}
                        onOpen={() => {
                          setOpen(false);
                          navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
                        }}
                        onDelete={() => {
                          if (confirm("Delete this conversation?")) {
                            deleteMut.mutate(t.id);
                            if (t.id === activeThreadId) navigate({ to: "/chat", replace: true });
                          }
                        }}
                        onPin={() => pinMut.mutate({ id: t.id, pinned: !t.pinned })}
                        onFolder={() => {
                          const cur = t.folder ?? "";
                          const name = prompt("Move to folder (blank = none)", cur);
                          if (name === null) return;
                          folderMut.mutate({ id: t.id, folder: name.trim() || null });
                        }}
                        onRename={() => {
                          const name = prompt("Rename conversation", t.title)?.trim();
                          if (!name) return;
                          renameMut.mutate({ id: t.id, title: name });
                        }}
                      />
                    ))}
                  </Section>
                )}
              </>
            ) : (
              <div className="px-3 py-8 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {query ? "No matches" : "No conversations yet"}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function FolderChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
        active
          ? "border-primary bg-primary/20 text-primary"
          : "border-primary/25 text-muted-foreground hover:border-primary/50 hover:text-primary"
      }`}
    >
      <Folder className="h-3 w-3" /> {label}
    </button>
  );
}

function Section({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      {label && (
        <div className="px-3 pb-1.5 pt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
          {label}
        </div>
      )}
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function ThreadRow({
  t,
  active,
  menuOpen,
  onMenu,
  onOpen,
  onDelete,
  onPin,
  onFolder,
  onRename,
}: {
  t: {
    id: string;
    title: string;
    folder: string | null;
    pinned: boolean;
  };
  active: boolean;
  menuOpen: boolean;
  onMenu: (v: boolean) => void;
  onOpen: () => void;
  onDelete: () => void;
  onPin: () => void;
  onFolder: () => void;
  onRename: () => void;
}) {
  return (
    <li className="group relative flex items-stretch gap-1">
      <button
        onClick={onOpen}
        className={`flex flex-1 min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
          active ? "bg-primary/15 text-primary" : "text-foreground/85 hover:bg-card"
        }`}
      >
        {t.pinned ? (
          <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
        ) : (
          <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
        {t.folder && (
          <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary/80">
            {t.folder}
          </span>
        )}
      </button>
      <button
        onClick={() => onMenu(!menuOpen)}
        className="rounded-lg px-2 text-muted-foreground hover:bg-card hover:text-foreground"
        aria-label="More"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menuOpen && (
        <div
          className="absolute right-1 top-11 z-20 flex w-40 flex-col rounded-lg border border-primary/40 bg-card p-1 shadow-lg"
          onMouseLeave={() => onMenu(false)}
        >
          <MenuItem onClick={() => { onMenu(false); onPin(); }} icon={t.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />} label={t.pinned ? "Unpin" : "Pin"} />
          <MenuItem onClick={() => { onMenu(false); onRename(); }} icon={<Pencil className="h-3.5 w-3.5" />} label="Rename" />
          <MenuItem onClick={() => { onMenu(false); onFolder(); }} icon={<Folder className="h-3.5 w-3.5" />} label="Folder…" />
          <MenuItem onClick={() => { onMenu(false); onDelete(); }} icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" destructive />
        </div>
      )}
    </li>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
        destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground/85 hover:bg-primary/10 hover:text-primary"
      }`}
    >
      {icon} {label}
    </button>
  );
}
