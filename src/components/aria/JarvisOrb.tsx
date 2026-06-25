import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HolographicCore } from "./HolographicCore";

export type OrbState = "idle" | "listening" | "thinking" | "speaking" | "alert";

interface JarvisOrbProps {
  state?: OrbState;
  size?: number;
  className?: string;
  /** 0..1 amplitude for speaking visualizer */
  amplitude?: number;
}

/**
 * Pure-SVG holographic JARVIS orb.
 * - Core sphere with Fresnel rim glow
 * - Three rotating gyro rings
 * - State-driven pulse / ripple / spin / FFT bars
 * - Drives color from --mood CSS var so it reacts to assistant mood
 */
export function JarvisOrb({
  state = "idle",
  size = 320,
  className,
  amplitude = 0,
}: JarvisOrbProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Gentle tilt toward cursor
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / window.innerWidth;
      const dy = (e.clientY - cy) / window.innerHeight;
      setTilt({ x: Math.max(-1, Math.min(1, dx * 2)), y: Math.max(-1, Math.min(1, dy * 2)) });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const pulseSpeed =
    state === "thinking" ? "1.1s" : state === "listening" ? "0.7s" : state === "speaking" ? "0.5s" : "2.4s";
  const ringSpeed = state === "thinking" ? "4s" : state === "speaking" ? "6s" : "18s";

  // Speaking FFT-ish bars around equator
  const bars = 36;
  const barArr = Array.from({ length: bars }, (_, i) => i);

  // For non-tiny sizes use the cinematic canvas core.
  if (size >= 120) {
    return (
      <div
        ref={wrapRef}
        className={cn("relative grid place-items-center select-none animate-hud-bob", className)}
        style={{ width: size, height: size }}
      >
        <HolographicCore state={state} size={size} amplitude={amplitude} />
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={cn("relative grid place-items-center select-none animate-hud-bob", className)}
      style={{
        width: size,
        height: size,
        perspective: 800,
      }}
    >
      <div
        className="relative grid place-items-center"
        style={{
          width: size,
          height: size,
          transform: `rotateY(${tilt.x * 12}deg) rotateX(${-tilt.y * 12}deg)`,
          transition: "transform 0.25s ease-out",
        }}
      >
        {/* Outer halo */}
        <div
          className="absolute inset-0 rounded-full animate-hud-pulse"
          style={{
            background: `radial-gradient(circle at 50% 50%, hsl(var(--mood) / 0.45) 0%, hsl(var(--mood) / 0.08) 40%, transparent 70%)`,
            filter: "blur(8px)",
            animationDuration: pulseSpeed,
          }}
        />

        {/* Ring 1 (slow) */}
        <svg
          viewBox="-100 -100 200 200"
          className="absolute inset-0 animate-hud-spin-slow"
          style={{ animationDuration: ringSpeed }}
        >
          <defs>
            <linearGradient id="ring1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(var(--mood))" stopOpacity="0.9" />
              <stop offset="50%" stopColor="hsl(var(--mood))" stopOpacity="0.1" />
              <stop offset="100%" stopColor="hsl(var(--mood))" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <circle cx="0" cy="0" r="92" fill="none" stroke="url(#ring1)" strokeWidth="1.2" />
          {Array.from({ length: 48 }).map((_, i) => {
            const a = (i / 48) * Math.PI * 2;
            const x1 = Math.cos(a) * 86;
            const y1 = Math.sin(a) * 86;
            const x2 = Math.cos(a) * (i % 4 === 0 ? 78 : 82);
            const y2 = Math.sin(a) * (i % 4 === 0 ? 78 : 82);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="hsl(var(--mood))"
                strokeOpacity={i % 4 === 0 ? 0.9 : 0.45}
                strokeWidth="0.8"
              />
            );
          })}
        </svg>

        {/* Ring 2 (reverse, tilted) */}
        <svg
          viewBox="-100 -100 200 200"
          className="absolute inset-0 animate-hud-spin-rev"
          style={{
            animationDuration: `calc(${ringSpeed} * 1.3)`,
            transform: "rotateX(72deg)",
          }}
        >
          <circle
            cx="0"
            cy="0"
            r="78"
            fill="none"
            stroke="hsl(var(--mood))"
            strokeOpacity="0.7"
            strokeDasharray="2 6"
            strokeWidth="1"
          />
        </svg>

        {/* Ring 3 (slow, opposite tilt) */}
        <svg
          viewBox="-100 -100 200 200"
          className="absolute inset-0 animate-hud-spin-slow"
          style={{
            animationDuration: `calc(${ringSpeed} * 1.7)`,
            transform: "rotateX(-58deg) rotateZ(28deg)",
          }}
        >
          <circle
            cx="0"
            cy="0"
            r="66"
            fill="none"
            stroke="hsl(var(--mood))"
            strokeOpacity="0.55"
            strokeDasharray="1 3"
            strokeWidth="0.8"
          />
        </svg>

        {/* Core sphere */}
        <div
          className="relative rounded-full animate-hud-pulse"
          style={{
            width: size * 0.42,
            height: size * 0.42,
            background: `radial-gradient(circle at 35% 30%, hsl(var(--mood) / 0.95) 0%, hsl(var(--mood) / 0.55) 35%, hsl(var(--mood) / 0.15) 70%, transparent 100%)`,
            boxShadow: `0 0 ${40 + amplitude * 60}px hsl(var(--mood) / ${0.55 + amplitude * 0.3}), inset 0 0 40px hsl(var(--mood) / 0.5)`,
            animationDuration: pulseSpeed,
          }}
        >
          {/* Specular highlight */}
          <div
            className="absolute rounded-full"
            style={{
              top: "12%",
              left: "18%",
              width: "32%",
              height: "20%",
              background: "radial-gradient(ellipse at center, rgba(255,255,255,0.6), transparent 70%)",
              filter: "blur(4px)",
            }}
          />
          {/* Inner data ring */}
          <div className="absolute inset-3 rounded-full border border-white/20" />
        </div>

        {/* Speaking equator bars */}
        {state === "speaking" && (
          <svg viewBox="-100 -100 200 200" className="absolute inset-0">
            {barArr.map((i) => {
              const a = (i / bars) * Math.PI * 2;
              const len = 4 + Math.abs(Math.sin(i * 0.7 + amplitude * 6)) * (4 + amplitude * 20);
              const x1 = Math.cos(a) * 50;
              const y1 = Math.sin(a) * 50;
              const x2 = Math.cos(a) * (50 + len);
              const y2 = Math.sin(a) * (50 + len);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--mood))"
                  strokeWidth="1.4"
                  strokeOpacity="0.9"
                />
              );
            })}
          </svg>
        )}

        {/* Scan sweep when listening */}
        {state === "listening" && (
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div
              className="absolute inset-x-0 h-px animate-hud-scan"
              style={{
                background: "linear-gradient(90deg, transparent, hsl(var(--mood)), transparent)",
                boxShadow: "0 0 12px hsl(var(--mood))",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
