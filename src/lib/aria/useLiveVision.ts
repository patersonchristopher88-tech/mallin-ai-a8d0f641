import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface VisionSample {
  text: string;
  at: number;
}

/**
 * Camera + Gemini vision loop. Handles getUserMedia, frame capture,
 * throttled POST to /api/vision, and optional TTS playback.
 */
export function useLiveVision(opts: {
  facingMode?: "user" | "environment";
  intervalMs?: number;
  brief?: boolean;
  speak?: boolean;
  autoStart?: boolean;
  prompt?: string;
} = {}) {
  const {
    facingMode = "environment",
    intervalMs = 3200,
    brief = true,
    speak = false,
    autoStart = false,
    prompt,
  } = opts;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [active, setActive] = useState(false);
  const [samples, setSamples] = useState<VisionSample[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const captureFrame = useCallback((): string | null => {
    const v = videoRef.current;
    if (!v || v.readyState < 2 || !v.videoWidth) return null;
    const maxW = 768;
    const scale = Math.min(1, maxW / v.videoWidth);
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.7);
  }, []);

  const analyzeOnce = useCallback(async (overridePrompt?: string) => {
    if (inflightRef.current) return;
    const frame = captureFrame();
    if (!frame) return;
    inflightRef.current = true;
    setThinking(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageBase64: frame,
          prompt: overridePrompt ?? prompt,
          brief,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { text } = (await res.json()) as { text: string };
      if (text) {
        setSamples((s) => [{ text, at: Date.now() }, ...s].slice(0, 12));
        if (speak) {
          try {
            const t = await fetch("/api/tts/lovable", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ text, voice: "alloy" }),
            });
            if (t.ok) {
              const blob = await t.blob();
              const url = URL.createObjectURL(blob);
              audioRef.current?.pause();
              const a = new Audio(url);
              audioRef.current = a;
              a.play().catch(() => {});
              a.onended = () => URL.revokeObjectURL(url);
            }
          } catch {
            /* speak best-effort */
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Vision failed";
      setLastError(msg);
    } finally {
      setThinking(false);
      inflightRef.current = false;
    }
  }, [brief, captureFrame, prompt, speak]);

  const start = useCallback(async () => {
    try {
      setLastError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.playsInline = true;
        await v.play().catch(() => {});
      }
      setActive(true);
      if (intervalMs > 0) {
        timerRef.current = window.setInterval(() => analyzeOnce(), intervalMs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera denied";
      setLastError(msg);
      toast.error(msg);
    }
  }, [analyzeOnce, facingMode, intervalMs]);

  useEffect(() => {
    if (autoStart) void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, active, start, stop, analyzeOnce, samples, thinking, lastError };
}
