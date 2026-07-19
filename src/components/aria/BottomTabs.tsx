import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquare, Sparkles, Image as ImageIcon, Music, Settings, Plus, Compass } from "lucide-react";
import { motion } from "motion/react";

const TABS = [
  { to: "/chat", label: "Chat", Icon: MessageSquare, match: "/chat" },
  { to: "/studio", label: "Studio", Icon: Sparkles, match: "/studio" },
  { to: "/vision", label: "Vision", Icon: Compass, match: "/vision" },
  { to: "/library", label: "Library", Icon: ImageIcon, match: "/library" },
  { to: "/settings", label: "Settings", Icon: Settings, match: "/settings" },
] as const;

export function BottomTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 -top-6 h-6"
        style={{
          background:
            "linear-gradient(to top, hsl(var(--mood) / 0.18), transparent)",
        }}
      />
      <div className="mx-auto mb-3 flex max-w-sm justify-center px-4">
        <Link
          to="/chat"
          className="hud-corner flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-4 py-2.5 font-display text-[10px] uppercase tracking-[0.35em] text-primary shadow-[0_0_18px_hsl(var(--primary)/0.2)]"
        >
          <Plus className="h-4 w-4" /> New command
        </Link>
      </div>
      <div className="hud-glass border-t border-primary/25">
        <ul className="relative mx-auto grid max-w-md grid-cols-5">
          {TABS.map(({ to, label, Icon, match }) => {
            const active = pathname === match || pathname.startsWith(match + "/");
            return (
              <li key={to} className="relative">
                <Link
                  to={to}
                  onClick={() => navigator.vibrate?.(6)}
                  className={`relative flex flex-col items-center gap-1 px-2 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                    active
                      ? "text-primary hud-text-glow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-indicator"
                      className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-primary"
                      style={{ boxShadow: "0 0 10px hsl(var(--primary))" }}
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {active && (
                    <motion.span
                      layoutId="tab-bg"
                      className="absolute inset-1 rounded-xl bg-primary/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <motion.span
                    className="relative z-10 grid place-items-center"
                    animate={active ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                    transition={{ duration: 0.5 }}
                  >
                    <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  </motion.span>
                  <span className="relative z-10">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export const BOTTOM_TABS_HEIGHT = 72;
