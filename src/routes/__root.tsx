import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { ThemeProvider } from "@/components/aria/ThemeProvider";
import { HudBackdrop } from "@/components/aria/HudBackdrop";
import { WakeWordManager } from "@/components/aria/WakeWordManager";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-primary hud-text-glow">404</h1>
        <h2 className="mt-4 font-display text-xl text-foreground">SIGNAL LOST</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-4 py-2 font-display text-sm uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
          >
            Return to ARIA
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl text-destructive hud-text-glow">SYSTEM FAULT</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-4 py-2 font-display text-sm uppercase tracking-widest text-primary transition-colors hover:bg-primary/20"
          >
            Retry
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 font-display text-sm uppercase tracking-widest text-foreground transition-colors hover:bg-secondary"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#02060f" },
      { title: "ARIA — your personal AI" },
      {
        name: "description",
        content:
          "ARIA is a holographic AI assistant inspired by JARVIS, FRIDAY, and Gideon. Talk, generate images, upload documents, and customize everything.",
      },
      { name: "author", content: "ARIA" },
      { property: "og:title", content: "ARIA — your personal AI" },
      {
        property: "og:description",
        content: "Holographic AI assistant with voice, image generation, document understanding, and deep customization.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ARIA — your personal AI" },
      { name: "description", content: "Ascend Assistant simulates advanced AI capabilities for intelligent interaction and customization." },
      { property: "og:description", content: "Ascend Assistant simulates advanced AI capabilities for intelligent interaction and customization." },
      { name: "twitter:description", content: "Ascend Assistant simulates advanced AI capabilities for intelligent interaction and customization." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5bc2f15b-ebe6-48b6-aa56-411e41322e5d/id-preview-e35d7d97--91884138-5f53-4a13-ac82-9c26be98f405.lovable.app-1782924759319.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5bc2f15b-ebe6-48b6-aa56-411e41322e5d/id-preview-e35d7d97--91884138-5f53-4a13-ac82-9c26be98f405.lovable.app-1782924759319.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <HudBackdrop />
        <div className="hud-grid" />
        <div className="hud-vignette" />
        <div className="hud-sweep" />
        <Outlet />
        <div className="hud-scanlines" />
        <div className="hud-noise" />
        <WakeWordManager />
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "bg-card border border-primary/30 text-foreground",
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
