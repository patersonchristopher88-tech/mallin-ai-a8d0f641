import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Continuous conversation mode with barge-in.
 * - Listens continuously via Web Speech API.
 * - Calls onFinal when the user finishes a phrase (final result).
 * - Reports interim speech so the caller can pause TTS audio (barge-in).
 * - Chromium-based browsers only.
 */
export function useCallMode(opts: {
  onFinal: (text: string) => void;
  onInterim?: () => void;
  lang?: string;
}) {
  const [active, setActive] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<{ start(): void; stop(): void; abort(): void } | null>(null);
  const stopRequested = useRef(false);

  const start = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition not supported in this browser");
      return;
    }
    stopRequested.current = false;
    const rec = new (SR as new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: unknown) => void;
      onerror: (e: { error?: string }) => void;
      onend: () => void;
      start(): void;
      stop(): void;
      abort(): void;
    })();
    rec.lang = opts.lang ?? "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      const e = event as {
        resultIndex: number;
        results: ArrayLike<{
          0: { transcript: string };
          isFinal: boolean;
          length: number;
        }>;
      };
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const chunk = res[0].transcript;
        if (res.isFinal) {
          const finalText = chunk.trim();
          if (finalText) opts.onFinal(finalText);
        } else {
          interimText += chunk;
        }
      }
      if (interimText) {
        setInterim(interimText);
        opts.onInterim?.();
      } else {
        setInterim("");
      }
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error ?? "speech-error");
    };
    rec.onend = () => {
      // Chrome ends the session periodically; restart unless the user asked to stop.
      if (!stopRequested.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      } else {
        setActive(false);
      }
    };
    try {
      rec.start();
      recRef.current = rec;
      setActive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "start failed");
    }
  }, [opts]);

  const stop = useCallback(() => {
    stopRequested.current = true;
    recRef.current?.stop();
    recRef.current = null;
    setActive(false);
    setInterim("");
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { active, interim, error, start, stop };
}
