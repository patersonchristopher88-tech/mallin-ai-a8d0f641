import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check } from "lucide-react";
import { PERSONAS, type PersonaKey } from "@/lib/aria/personas";
import { updateProfile } from "@/lib/aria/profile.functions";
import { toast } from "sonner";

export function PersonaSwitcher({
  current,
  assistantName,
}: {
  current: PersonaKey;
  assistantName: string;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const update = useServerFn(updateProfile);

  const mut = useMutation({
    mutationFn: (persona: PersonaKey) => update({ data: { persona } }),
    onSuccess: (_d, persona) => {
      toast.success(`Switched to ${PERSONAS[persona].name}`);
      navigator.vibrate?.([6, 30, 8]);
      qc.invalidateQueries({ queryKey: ["profile"] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const display = PERSONAS[current] ?? PERSONAS.jarvis;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-0 items-center gap-1 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <span className="truncate font-display text-xs uppercase tracking-[0.25em] text-primary hud-text-glow">
              {assistantName}
            </span>
            <ChevronDown className="h-3 w-3 text-primary/70" />
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            {display.name} · online
          </div>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="hud-glass absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-primary/30"
            >
              <div className="border-b border-primary/15 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-primary/70">
                /// Persona
              </div>
              <ul>
                {(Object.keys(PERSONAS) as PersonaKey[])
                  .filter((k) => k !== "custom")
                  .map((k) => {
                    const p = PERSONAS[k];
                    const active = k === current;
                    return (
                      <li key={k}>
                        <button
                          onClick={() => mut.mutate(k)}
                          disabled={mut.isPending}
                          className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
                            active ? "bg-primary/10" : "hover:bg-primary/5"
                          }`}
                        >
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: p.accentColor, boxShadow: `0 0 8px ${p.accentColor}` }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-display text-xs uppercase tracking-[0.2em] text-foreground">
                              {p.name}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {p.tagline}
                            </span>
                          </span>
                          {active && <Check className="mt-1 h-3 w-3 text-primary" />}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
