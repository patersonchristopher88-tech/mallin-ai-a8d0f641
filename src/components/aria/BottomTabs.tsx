import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquare, Sparkles, Image as ImageIcon, Settings } from "lucide-react";

const TABS = [
  { to: "/chat", label: "Chat", Icon: MessageSquare, match: "/chat" },
  { to: "/studio", label: "Studio", Icon: Sparkles, match: "/studio" },
  { to: "/library", label: "Library", Icon: ImageIcon, match: "/library" },
  { to: "/settings", label: "Settings", Icon: Settings, match: "/settings" },
] as const;

export function BottomTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/20 bg-background/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ to, label, Icon, match }) => {
          const active = pathname === match || pathname.startsWith(match + "/");
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 px-2 py-2.5 font-mono text-[10px] uppercase tracking-widest transition ${
                  active
                    ? "text-primary hud-text-glow"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span>{label}</span>
                {active && (
                  <span
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                    style={{ boxShadow: "0 0 8px hsl(var(--primary))" }}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const BOTTOM_TABS_HEIGHT = 64;
