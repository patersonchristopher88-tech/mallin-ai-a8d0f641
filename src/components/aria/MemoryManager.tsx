import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Brain, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listMemories, addMemory, deleteMemory } from "@/lib/aria/memories.functions";

export function MemoryManager() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMemories);
  const addFn = useServerFn(addMemory);
  const delFn = useServerFn(deleteMemory);
  const [draft, setDraft] = useState("");

  const memories = useQuery({ queryKey: ["memories"], queryFn: () => listFn({}) });

  const add = useMutation({
    mutationFn: (content: string) => addFn({ data: { content } }),
    onSuccess: () => {
      setDraft("");
      toast.success("Memory saved");
      qc.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memories"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="hud-panel rounded-2xl p-4">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <Brain className="h-4 w-4 shrink-0 text-primary" />
        <h3 className="truncate font-display text-sm uppercase tracking-widest text-primary">
          Memory
        </h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Facts ARIA remembers about you across every conversation.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim();
          if (v) add.mutate(v);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Remember that…"
          aria-label="New memory"
          className="hud-glass min-w-0 flex-1 rounded-xl border border-primary/25 px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={add.isPending || !draft.trim()}
          aria-label="Save memory"
          className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/40 bg-primary/10 text-primary transition hover:bg-primary/20 disabled:opacity-40"
        >
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </form>

      <ul className="mt-3 divide-y divide-primary/10">
        {memories.isLoading && (
          <li className="py-3 text-sm text-muted-foreground">Loading memories…</li>
        )}
        {memories.data?.length === 0 && (
          <li className="py-3 text-sm text-muted-foreground">No memories yet.</li>
        )}
        {(memories.data ?? []).map((m) => (
          <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
            <span className="min-w-0 text-sm text-foreground">{m.content}</span>
            <button
              onClick={() => remove.mutate(m.id)}
              aria-label="Forget this"
              className="shrink-0 p-1 text-muted-foreground transition hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
