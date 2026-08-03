import { useCallback, useEffect, useRef, useState } from "react";

export type GestureName =
  | "none"
  | "pinch"
  | "grab"
  | "point"
  | "open"
  | "flick"
  | "swipe-left"
  | "swipe-right"
  | "scale";

export interface HandFrame {
  /** normalised 0..1, x already mirrored for a selfie view */
  x: number;
  y: number;
  pinch: number; // 0..1, 1 = fully pinched
  grabbed: boolean;
  gesture: GestureName;
}

export interface GestureState {
  hands: HandFrame[];
  /** distance between two hands, normalised; null with fewer than 2 hands */
  spread: number | null;
  /** signed rotation of the two-hand axis in radians */
  rotation: number | null;
  gesture: GestureName;
}

const EMPTY: GestureState = { hands: [], spread: null, rotation: null, gesture: "none" };

type LandmarkerLike = {
  detectForVideo: (
    v: HTMLVideoElement,
    ts: number,
  ) => { landmarks?: { x: number; y: number; z: number }[][] };
  close: () => void;
};

/**
 * MediaPipe hand tracking → high-level spatial gestures.
 * Falls back gracefully (active=false, lastError set) when unsupported.
 */
export function useHandGestures() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<LandmarkerLike | null>(null);
  const rafRef = useRef(0);
  const stateRef = useRef<GestureState>(EMPTY);
  const prevRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const swipeCooldown = useRef(0);

  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [state, setState] = useState<GestureState>(EMPTY);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    stateRef.current = EMPTY;
    setState(EMPTY);
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    if (active || loading) return;
    setLoading(true);
    setLastError(null);
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
      );
      const lm = await vision.HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
      landmarkerRef.current = lm as unknown as LandmarkerLike;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (!v) throw new Error("Camera element missing");
      v.srcObject = stream;
      await v.play();

      setActive(true);
      setLoading(false);

      let lastTs = -1;
      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        const vid = videoRef.current;
        const landmarker = landmarkerRef.current;
        if (!vid || !landmarker || vid.readyState < 2) return;
        const ts = performance.now();
        if (ts - lastTs < 33) return;
        lastTs = ts;

        let res: { landmarks?: { x: number; y: number; z: number }[][] };
        try {
          res = landmarker.detectForVideo(vid, ts);
        } catch {
          return;
        }
        const hands: HandFrame[] = (res.landmarks ?? []).map((pts) => {
          const tip = pts[8];
          const thumb = pts[4];
          const wrist = pts[0];
          const mid = pts[12];
          const ring = pts[16];
          const scale = Math.hypot(pts[5].x - wrist.x, pts[5].y - wrist.y) || 0.1;
          const pinchDist = Math.hypot(tip.x - thumb.x, tip.y - thumb.y) / scale;
          const pinch = Math.max(0, Math.min(1, 1 - (pinchDist - 0.35) / 1.1));
          const curl =
            (Math.hypot(mid.x - wrist.x, mid.y - wrist.y) + Math.hypot(ring.x - wrist.x, ring.y - wrist.y)) /
            (2 * scale);
          const grabbed = curl < 1.6 && pinch > 0.35;
          const pointing = curl > 1.9 && pinch < 0.3;
          const gesture: GestureName = grabbed ? "grab" : pinch > 0.7 ? "pinch" : pointing ? "point" : "open";
          return {
            x: 1 - (tip.x + thumb.x) / 2,
            y: (tip.y + thumb.y) / 2,
            pinch,
            grabbed,
            gesture,
          };
        });

        let spread: number | null = null;
        let rotation: number | null = null;
        if (hands.length >= 2) {
          const [a, b] = hands;
          spread = Math.hypot(a.x - b.x, a.y - b.y);
          rotation = Math.atan2(b.y - a.y, b.x - a.x);
        }

        let gesture: GestureName = hands[0]?.gesture ?? "none";
        if (hands.length >= 2) gesture = "scale";

        // Swipe / flick detection on the primary hand.
        const primary = hands[0];
        if (primary) {
          const prev = prevRef.current;
          const now = performance.now();
          if (prev) {
            const dt = Math.max(16, now - prev.t);
            const vx = ((primary.x - prev.x) / dt) * 1000;
            if (Math.abs(vx) > 1.4 && now > swipeCooldown.current && hands.length === 1) {
              gesture = vx > 0 ? "swipe-right" : "swipe-left";
              swipeCooldown.current = now + 700;
            }
          }
          prevRef.current = { x: primary.x, y: primary.y, t: now };
        } else {
          prevRef.current = null;
        }

        const next: GestureState = { hands, spread, rotation, gesture };
        stateRef.current = next;
        setState(next);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      setLoading(false);
      setActive(false);
      setLastError(e instanceof Error ? e.message : "Hand tracking unavailable");
    }
  }, [active, loading]);

  useEffect(() => stop, [stop]);

  return { videoRef, start, stop, active, loading, lastError, state, stateRef };
}
