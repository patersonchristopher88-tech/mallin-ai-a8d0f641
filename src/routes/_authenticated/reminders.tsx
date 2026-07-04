import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listReminders,
  createReminder,
  toggleReminder,
  deleteReminder,
} from "@/lib/aria/reminders.functions";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, BellRing, Plus, Trash2, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reminders")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reminders — ARIA" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listReminders);
  const createFn = useServerFn(createReminder);
  const toggleFn = useServerFn(toggleReminder);
  const delFn = useServerFn(deleteReminder);

  const q = useQuery({ queryKey: ["reminders"], queryFn: () => listFn() });

  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  // Schedule browser notifications for future reminders while page is open.
  const timers = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const active = timers.current;
    // Clear previous timers
    for (const t of active.values()) window.clearTimeout(t);
    active.clear();
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const now = Date.now();
    for (const r of q.data ?? []) {
      if (r.done || !r.due_at) continue;
      const due = new Date(r.due_at).getTime();
      const delay = due - now;
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const id = window.setTimeout(() => {
          try {
            new Notification("ARIA reminder", {
              body: r.text,
              icon: "/favicon.ico",
              tag: r.id,
            });
          } catch {
            /* ignore */
          }
        }, delay);
        active.set(r.id, id);
      }
    }
    return () => {
      for (const t of active.values()) window.clearTimeout(t);
      active.clear();
    };
  }, [q.data]);

  const createMut = useMutation({
    mutationFn: (v: { text: string; due_at: string }) => createFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setText("");
      setWhen("");
      toast.success("Reminder set");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !when) return;
    const iso = new Date(when).toISOString();
    if (isNaN(Date.parse(iso))) return toast.error("Invalid date");
    createMut.mutate({ text: text.trim(), due_at: iso });
  }

  async function requestPerm() {
    if (typeof Notification === "undefined") return toast.error("Notifications unsupported");
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success("Notifications enabled");
  }

  const { upcoming, done } = useMemo(() => {
    const rows = q.data ?? [];
    return {
      upcoming: rows.filter((r) => !r.done),
      done: rows.filter((r) => r.done),
    };
  }, [q.data]);

  return (
    <div className="mx-auto flex min-h-0 max-w-2xl flex-1 flex-col px-4 py-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link
          to="/chat"
          className="grid h-10 w-10 place-items-center rounded-lg border border-primary/30 bg-card/60 text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h1 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
            Reminders
          </h1>
        </div>
        <div className="ml-auto">
          {permission !== "granted" && (
            <button
              onClick={requestPerm}
              className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-accent"
            >
              Enable notifications
            </button>
          )}
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="hud-corner mb-6 rounded-xl border border-primary/25 bg-card/50 p-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Remind me to…"
          className="mb-2 w-full rounded-md border border-primary/20 bg-transparent px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
        />
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="flex-1 rounded-md border border-primary/20 bg-transparent px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || !when || createMut.isPending}
            className="grid h-10 w-10 place-items-center rounded-md border border-primary bg-primary/15 text-primary disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>

      <section className="mb-6">
        <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
          Upcoming ({upcoming.length})
        </h2>
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {upcoming.map((r) => (
              <ReminderRow
                key={r.id}
                r={r}
                onToggle={() => toggleMut.mutate({ id: r.id, done: true })}
                onDelete={() => delMut.mutate(r.id)}
              />
            ))}
          </AnimatePresence>
          {upcoming.length === 0 && (
            <li className="rounded-md border border-dashed border-primary/20 px-3 py-6 text-center text-xs text-muted-foreground">
              No upcoming reminders. Ask ARIA to schedule one.
            </li>
          )}
        </ul>
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Done ({done.length})
          </h2>
          <ul className="space-y-1.5 opacity-60">
            {done.slice(0, 20).map((r) => (
              <ReminderRow
                key={r.id}
                r={r}
                onToggle={() => toggleMut.mutate({ id: r.id, done: false })}
                onDelete={() => delMut.mutate(r.id)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReminderRow({
  r,
  onToggle,
  onDelete,
}: {
  r: { id: string; text: string; due_at: string | null; done: boolean };
  onToggle: () => void;
  onDelete: () => void;
}) {
  const due = r.due_at ? new Date(r.due_at) : null;
  const overdue = !r.done && due != null && due.getTime() < Date.now();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
        overdue ? "border-destructive/40 bg-destructive/5" : "border-primary/20 bg-card/40"
      }`}
    >
      <button
        onClick={onToggle}
        aria-label="Toggle done"
        className={`grid h-6 w-6 place-items-center rounded border ${
          r.done ? "border-primary bg-primary/20 text-primary" : "border-muted-foreground/40"
        }`}
      >
        {r.done && <Check className="h-3 w-3" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm ${r.done ? "line-through" : ""}`}>{r.text}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {due ? due.toLocaleString() : "No date"}
        </div>
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete"
        className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.li>
  );
}
