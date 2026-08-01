import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home as HomeIcon,
  MessageSquare,
  FolderOpen,
  Settings,
  Plus,
  Sparkles,
  Camera,
  Wand2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

const TABS = [
  { to: "/home", label: "Home", Icon: HomeIcon, match: "/home" },
  { to: "/chat", label: "Chat", Icon: MessageSquare, match: "/chat" },
  { to: "/projects", label: "Projects", Icon: FolderOpen, match: "/projects" },
  { to: "/settings", label: "Settings", Icon: Settings, match: "/settings" },
] as const;

const FAB_ACTIONS = [
  { to: "/studio", label: "Studio", Icon: Sparkles },
  { to: "/vision", label: "Vision", Icon: Camera },
  { to: "/edit", label: "Edit image", Icon: Wand2 },
  { to: "/chat", label: "New chat", Icon: MessageSquare },
] as const;

export function BottomTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-label="Close quick create"
            className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      <nav
        className="fixed inset-x-0 bottom-0 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Quick-create menu */}
        <AnimatePresence>
          {open && (
            <motion.ul
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="mx-auto mb-3 grid w-[min(22rem,calc(100%-2rem))] grid-cols-2 gap-2"
            >
              {FAB_ACTIONS.map(({ to, label, Icon }) => (
                <li key={label}>
                  <Link
                    to={to}
                    onClick={() => setOpen(false)}
                    className="hud-glass hud-corner flex items-center gap-2 rounded-2xl border border-primary/30 px-3 py-3 font-display text-xs uppercase tracking-widest text-foreground transition hover:border-primary/60"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        <div
          className="pointer-events-none absolute inset-x-0 -top-6 h-6"
          style={{ background: "linear-gradient(to top, hsl(var(--mood) / 0.18), transparent)" }}
        />

        <div className="hud-glass border-t border-primary/25">
          <ul className="relative mx-auto grid max-w-md grid-cols-5 items-end">
            {TABS.slice(0, 2).map((t) => (
              <TabItem key={t.to} {...t} pathname={pathname} />
            ))}

            <li className="relative flex justify-center">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  setOpen((v) => !v);
                  navigator.vibrate?.(8);
                }}
                aria-label={open ? "Close quick create" : "Open quick create"}
                aria-expanded={open}
                className="-mt-5 grid size-14 place-items-center rounded-2xl border border-primary bg-primary/20 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.45)] backdrop-blur-md"
              >
                <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
                  {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                </motion.span>
              </motion.button>
            </li>

            {TABS.slice(2).map((t) => (
              <TabItem key={t.to} {...t} pathname={pathname} />
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}

function TabItem({
  to,
  label,
  Icon,
  match,
  pathname,
}: {
  to: string;
  label: string;
  Icon: typeof HomeIcon;
  match: string;
  pathname: string;
}) {
  const active = pathname === match || pathname.startsWith(match + "/");
  return (
    <li className="relative">
      <Link
        to={to}
        onClick={() => navigator.vibrate?.(6)}
        className={`relative flex flex-col items-center gap-1 px-2 py-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
          active ? "text-primary hud-text-glow" : "text-muted-foreground hover:text-foreground"
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
}

export const BOTTOM_TABS_HEIGHT = 72;
