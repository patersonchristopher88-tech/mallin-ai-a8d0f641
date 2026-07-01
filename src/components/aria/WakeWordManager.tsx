import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

/**
 * Global wake-word + hotkey listener.
 * - Web Speech API (SpeechRecognition) for "hey aria" / configurable phrase.
 * - Global hotkey (default Ctrl/Cmd+Shift+A) to open chat.
 * Reads preferences from localStorage:
 *   aria.wakeWordEnabled  ("1" | "0"), default "0"
 *   aria.wakeWordPhrase   default "hey aria"
 *   aria.hotkey           default "mod+shift+a"
 *   aria.hotkeyTarget     "/chat" | "/vision" | "/ar"  default "/chat"
 */
export function WakeWordManager() {
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(false);
  const [phrase, setPhrase] = useState("hey aria");
  const recRef = useRef<unknown>(null);
  const stopFlagRef = useRef(false);

  // Load prefs (and react to changes cross-tab).
  useEffect(() => {
    const load = () => {
      setEnabled(localStorage.getItem("aria.wakeWordEnabled") === "1");
      setPhrase((localStorage.getItem("aria.wakeWordPhrase") || "hey aria").toLowerCase());
    };
    load();
    const onStorage = () => load();
    window.addEventListener("storage", onStorage);
    window.addEventListener("aria:prefs", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("aria:prefs", onStorage);
    };
  }, []);

  // Hotkey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const combo = (localStorage.getItem("aria.hotkey") || "mod+shift+a").toLowerCase();
      const parts = combo.split("+");
      const needMod = parts.includes("mod") ? e.metaKey || e.ctrlKey : true;
      const needShift = parts.includes("shift") ? e.shiftKey : !e.shiftKey;
      const needAlt = parts.includes("alt") ? e.altKey : !e.altKey;
      const key = parts[parts.length - 1];
      if (needMod && needShift && needAlt && e.key.toLowerCase() === key) {
        e.preventDefault();
        const target = localStorage.getItem("aria.hotkeyTarget") || "/chat";
        void navigate({ to: target });
        try {
          navigator.vibrate?.(20);
        } catch {
          /* noop */
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // Wake word
  useEffect(() => {
    if (!enabled) {
      stopFlagRef.current = true;
      try {
        (recRef.current as { stop?: () => void } | null)?.stop?.();
      } catch {
        /* noop */
      }
      recRef.current = null;
      return;
    }
    const SR =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;
    if (!SR) {
      toast.error("Wake word requires a Chromium-based browser (Web Speech API).");
      localStorage.setItem("aria.wakeWordEnabled", "0");
      setEnabled(false);
      return;
    }
    stopFlagRef.current = false;

    interface SRLike {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
      onerror: ((e: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    }
    const rec = new (SR as new () => SRLike)();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const text = last?.[0]?.transcript?.toLowerCase().trim() ?? "";
      if (text.includes(phrase)) {
        try {
          navigator.vibrate?.([30, 60, 30]);
        } catch {
          /* noop */
        }
        toast.success(`Wake word detected — "${phrase}"`);
        rec.stop();
        void navigate({ to: "/chat" });
      }
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        toast.error("Microphone permission is required for wake word.");
        localStorage.setItem("aria.wakeWordEnabled", "0");
        setEnabled(false);
      }
    };
    rec.onend = () => {
      if (!stopFlagRef.current) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
      }
    };
    try {
      rec.start();
      recRef.current = rec;
    } catch {
      /* noop */
    }
    return () => {
      stopFlagRef.current = true;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
  }, [enabled, phrase, navigate]);

  return null;
}
