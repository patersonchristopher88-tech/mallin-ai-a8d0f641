import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Camera, Glasses, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type * as ThreeNS from "three";
import { useLiveVision } from "@/lib/aria/useLiveVision";
import { JarvisOrb } from "@/components/aria/JarvisOrb";

export const Route = createFileRoute("/_authenticated/ar")({
  ssr: false,
  head: () => ({ meta: [{ title: "AR — ARIA" }] }),
  component: ARPage,
});

type ARMode = "overlay" | "webxr";

function ARPage() {
  const [mode, setMode] = useState<ARMode>("overlay");
  const [webxrSupported, setWebxrSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported?: (m: string) => Promise<boolean> } }).xr;
    if (xr?.isSessionSupported) {
      xr.isSessionSupported("immersive-ar")
        .then((ok) => setWebxrSupported(ok))
        .catch(() => setWebxrSupported(false));
    } else {
      setWebxrSupported(false);
    }
  }, []);

  return (
    <main className="relative z-10 flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-primary/15 bg-background/85 px-4 py-2.5 backdrop-blur">
        <Link to="/chat" className="flex items-center gap-2 text-primary/80">
          <ArrowLeft className="h-4 w-4" />
          <span className="font-display text-xs uppercase tracking-[0.3em]">AR Mode</span>
        </Link>
        <div className="flex rounded-lg border border-primary/25 bg-card/60 p-0.5">
          {(["overlay", "webxr"] as ARMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative flex items-center gap-1.5 rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                mode === m ? "text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {mode === m && (
                <motion.span layoutId="ar-mode" className="absolute inset-0 rounded-md bg-primary" />
              )}
              <span className="relative flex items-center gap-1.5">
                {m === "overlay" ? <Camera className="h-3 w-3" /> : <Glasses className="h-3 w-3" />}
                {m === "overlay" ? "Phone" : "WebXR"}
              </span>
            </button>
          ))}
        </div>
      </header>

      {mode === "overlay" ? <PhoneOverlay /> : <WebXRMode supported={webxrSupported} />}
    </main>
  );
}

/** Phone camera + orb + live annotations. */
function PhoneOverlay() {
  const { videoRef, active, start, stop, samples, thinking, analyzeOnce, lastError } = useLiveVision({
    facingMode: "environment",
    intervalMs: 4200,
    brief: true,
    speak: false,
  });

  return (
    <div className="relative flex-1 overflow-hidden bg-black">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />

      {/* Orb — floats over the world */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <motion.div
          animate={{ y: [-6, 6, -6] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <JarvisOrb state={thinking ? "thinking" : "idle"} size={220} />
        </motion.div>
      </div>

      {/* HUD ticks */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-3 top-3 h-6 w-6 border-l-2 border-t-2 border-primary" />
        <span className="absolute right-3 top-3 h-6 w-6 border-r-2 border-t-2 border-primary" />
        <span className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-primary" />
        <span className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-primary" />
      </div>

      {!active && (
        <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur">
          <div className="hud-corner hud-glass max-w-xs rounded-2xl border border-primary/30 p-6 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-primary" />
            <h2 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
              Phone AR
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              ARIA hovers over your camera feed and describes what it sees.
            </p>
            {lastError && <p className="mt-3 text-xs text-destructive">{lastError}</p>}
            <button
              onClick={() => start()}
              className="mt-4 hud-corner inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/15 px-4 py-2 font-display text-xs uppercase tracking-widest text-primary hover:bg-primary/25"
            >
              <Camera className="h-4 w-4" /> Launch
            </button>
          </div>
        </div>
      )}

      {active && (
        <>
          {samples[0] && (
            <motion.div
              key={samples[0].at}
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="absolute inset-x-6 bottom-32 mx-auto max-w-sm rounded-lg border border-primary/40 bg-background/80 px-3 py-2 text-center font-mono text-[13px] text-foreground backdrop-blur"
            >
              {samples[0].text}
            </motion.div>
          )}
          <div className="absolute inset-x-0 bottom-6 flex justify-center gap-3">
            <button
              onClick={() => analyzeOnce()}
              className="hud-corner rounded-full border border-primary bg-primary/20 px-5 py-2 font-display text-xs uppercase tracking-widest text-primary"
            >
              Look now
            </button>
            <button
              onClick={() => stop()}
              className="rounded-full border border-destructive/50 bg-destructive/15 px-4 py-2 font-display text-xs uppercase tracking-widest text-destructive"
            >
              End
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** WebXR immersive-ar (Quest / Vision Pro / Android Chrome). */
function WebXRMode({ supported }: { supported: boolean | null }) {
  const [sessionActive, setSessionActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  async function launch() {
    const xr = (navigator as Navigator & {
      xr?: { requestSession?: (mode: string, opts?: unknown) => Promise<XRSession> };
    }).xr;
    if (!xr?.requestSession) {
      toast.error("WebXR isn't available on this device or browser.");
      return;
    }
    try {
      const THREE = await import("three");
      const canvas = canvasRef.current!;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType("local");

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 40);
      scene.add(new THREE.HemisphereLight(0x88ddff, 0x112233, 1.4));

      const group = new THREE.Group();
      group.position.set(0, 0, -0.9);
      scene.add(group);

      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.12, 4),
        new THREE.MeshBasicMaterial({ color: 0x22e1ff, wireframe: true, transparent: true, opacity: 0.9 }),
      );
      group.add(orb);

      const rings: ThreeNS.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.16 + i * 0.03, 0.003, 8, 64),
          new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.7 }),
        );
        ring.rotation.x = (i * Math.PI) / 3;
        rings.push(ring);
        group.add(ring);
      }

      const session = await xr.requestSession("immersive-ar", {
        requiredFeatures: ["local"],
        optionalFeatures: ["dom-overlay", "hit-test"],
      });
      // three.js owns the base layer + reference space from here.
      await renderer.xr.setSession(session);
      setSessionActive(true);

      const clock = new THREE.Clock();
      renderer.setAnimationLoop(() => {
        const t = clock.getElapsedTime();
        orb.rotation.y = t * 0.6;
        orb.rotation.x = t * 0.3;
        rings.forEach((r, i) => (r.rotation.z = t * (0.4 + i * 0.25)));
        renderer.render(scene, camera);
      });

      const cleanup = () => {
        renderer.setAnimationLoop(null);
        renderer.dispose();
        setSessionActive(false);
        cleanupRef.current = null;
      };
      cleanupRef.current = () => {
        void session.end().catch(() => {});
        cleanup();
      };
      session.addEventListener("end", cleanup);
    } catch (err) {
      setSessionActive(false);
      toast.error(err instanceof Error ? err.message : "Couldn't start the AR session.");
    }
  }


  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-4 bg-black/60 p-6">
      <canvas ref={canvasRef} className="hidden" />
      <div className="hud-corner hud-glass max-w-sm rounded-2xl border border-primary/30 p-6 text-center">
        <Glasses className="mx-auto mb-3 h-8 w-8 text-primary" />
        <h2 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
          Immersive AR
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          {supported === null
            ? "Checking device support…"
            : supported
              ? "Your device supports WebXR. Launch to place ARIA in your room."
              : "This device doesn't support WebXR AR. Try a Meta Quest, Vision Pro, or Android Chrome."}
        </p>
        <button
          disabled={!supported || sessionActive}
          onClick={launch}
          className="mt-4 hud-corner inline-flex items-center gap-2 rounded-lg border border-primary bg-primary/15 px-4 py-2 font-display text-xs uppercase tracking-widest text-primary hover:bg-primary/25 disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          {sessionActive ? "In session" : supported ? "Enter AR" : "Not supported"}
        </button>
      </div>
    </div>
  );
}
