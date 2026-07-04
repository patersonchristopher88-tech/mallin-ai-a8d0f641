import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MonitorUp, ScanLine, Loader2, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { JarvisOrb } from "@/components/aria/JarvisOrb";

export const Route = createFileRoute("/_authenticated/screen")({
  ssr: false,
  head: () => ({ meta: [{ title: "Screen Share — ARIA" }] }),
  component: ScreenPage,
});

function ScreenPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [sharing, setSharing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [question, setQuestion] = useState("What is on my screen?");
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      stream.getVideoTracks()[0]?.addEventListener("ended", stop);
      setSharing(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Screen share denied");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setSharing(false);
  }

  async function captureFrame(): Promise<string | null> {
    const v = videoRef.current;
    if (!v || v.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / v.videoWidth);
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }

  async function analyze() {
    if (analyzing) return;
    const frame = await captureFrame();
    if (!frame) return toast.error("No frame available yet");
    setAnalyzing(true);
    setAnalysis("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imageBase64: frame, prompt: question }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { text?: string };
      setAnalysis(j.text ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-0 max-w-3xl flex-1 flex-col px-4 py-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link
          to="/chat"
          className="grid h-10 w-10 place-items-center rounded-lg border border-primary/30 bg-card/60 text-primary"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <MonitorUp className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg uppercase tracking-widest text-primary hud-text-glow">
          Screen Share
        </h1>
      </header>

      <div className="relative mb-3 overflow-hidden rounded-xl border border-primary/25 bg-black/60">
        {!sharing && (
          <div className="grid aspect-video place-items-center gap-3">
            <JarvisOrb state="idle" size={100} />
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              Share your screen so ARIA can see what you're working on.
            </p>
            <button
              onClick={start}
              className="rounded-lg border border-primary bg-primary/15 px-4 py-2 font-mono text-xs uppercase tracking-widest text-primary"
            >
              Start Share
            </button>
          </div>
        )}
        <video
          ref={videoRef}
          className={`h-auto w-full ${sharing ? "block" : "hidden"}`}
          muted
          playsInline
        />
      </div>

      {sharing && (
        <>
          <div className="mb-3 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What should ARIA look at?"
              className="flex-1 rounded-md border border-primary/25 bg-card/40 px-3 py-2 text-sm focus:border-primary/60 focus:outline-none"
            />
            <button
              onClick={analyze}
              disabled={analyzing}
              className="grid h-10 place-items-center rounded-md border border-primary bg-primary/15 px-3 text-primary disabled:opacity-40"
            >
              {analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={stop}
              className="grid h-10 place-items-center rounded-md border border-destructive/40 bg-destructive/10 px-3 text-destructive"
              aria-label="Stop"
            >
              <StopCircle className="h-4 w-4" />
            </button>
          </div>
          {analysis && (
            <div className="hud-corner rounded-xl border border-primary/25 bg-card/50 p-3 text-sm leading-relaxed">
              {analysis}
            </div>
          )}
        </>
      )}
    </div>
  );
}
