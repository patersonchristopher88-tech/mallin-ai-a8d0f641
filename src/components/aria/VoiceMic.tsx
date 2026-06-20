import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceMicProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

/**
 * Big mic button. Tap to start recording, tap to stop and transcribe.
 * Posts the recorded blob to /api/stt and resolves with the final transcript.
 */
export function VoiceMic({ onTranscript, disabled }: VoiceMicProps) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType =
        ["audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      if (!mimeType) {
        toast.error("This browser can't record audio in a supported format.");
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const rec = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        if (blob.size < 1024) {
          toast.error("That was too short — try again.");
          setState("idle");
          return;
        }
        setState("uploading");
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          const ext =
            ({ "audio/webm": "webm", "audio/mp4": "mp4" } as Record<string, string>)[
              rec.mimeType.split(";")[0]
            ] ?? "webm";
          const fd = new FormData();
          fd.append("audio", blob, `recording.${ext}`);
          const res = await fetch("/api/stt", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: fd,
          });
          if (!res.ok) throw new Error(await res.text());
          const { text } = (await res.json()) as { text: string };
          if (text?.trim()) onTranscript(text.trim());
          else toast.error("No speech detected.");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recorderRef.current = rec;
      setState("recording");
      navigator.vibrate?.(10);
    } catch {
      toast.error("Microphone permission denied.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    navigator.vibrate?.(10);
  }

  const isRec = state === "recording";
  const isUp = state === "uploading";

  return (
    <button
      type="button"
      onClick={isRec ? stop : start}
      disabled={disabled || isUp}
      aria-label={isRec ? "Stop recording" : "Record voice"}
      className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full border transition ${
        isRec
          ? "border-destructive bg-destructive/20 text-destructive animate-pulse"
          : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
      } disabled:opacity-40`}
    >
      {isUp ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isRec ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
      {isRec && (
        <span
          className="absolute -inset-1 rounded-full border border-destructive/50"
          style={{ animation: "hud-pulse 0.9s ease-in-out infinite" }}
        />
      )}
    </button>
  );
}
