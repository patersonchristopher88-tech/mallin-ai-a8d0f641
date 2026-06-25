import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { OrbState } from "./JarvisOrb";

interface Props {
  state?: OrbState;
  size?: number;
  amplitude?: number;
  className?: string;
}

/**
 * GPU-light, canvas-driven holographic core.
 * Animated particle sphere + arc-reactor rings + Fresnel rim.
 * Reads --mood CSS var as `H S% L%` and renders mood-reactive light.
 */
export function HolographicCore({ state = "idle", size = 320, amplitude = 0, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({ state, amplitude });
  stateRef.current = { state, amplitude };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const R = size * 0.34;

    // Particle field on sphere surface (fibonacci lattice).
    const N = Math.min(420, Math.floor(size * 1.6));
    const particles = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = i * 2.39996; // golden angle
      return {
        x: Math.cos(theta) * r,
        y,
        z: Math.sin(theta) * r,
        s: 0.4 + Math.random() * 1.4,
        tw: Math.random() * Math.PI * 2,
      };
    });

    // Rings: arc-reactor style.
    const rings = [
      { tilt: 0.0, speed: 0.18, r: 0.95, dash: false },
      { tilt: 1.1, speed: -0.32, r: 0.86, dash: true },
      { tilt: -0.6, speed: 0.22, r: 0.78, dash: true },
    ];

    // Orbiters
    const orbiters = Array.from({ length: 3 }, (_, i) => ({
      phase: (i / 3) * Math.PI * 2,
      tilt: 0.6 + i * 0.4,
      speed: 0.6 + i * 0.18,
    }));

    const readMood = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--mood").trim();
      return v || "188 100% 56%";
    };

    let mood = readMood();
    const moodPoll = setInterval(() => (mood = readMood()), 250);

    let rafId = 0;
    let t0 = performance.now();

    const draw = () => {
      const t = (performance.now() - t0) / 1000;
      const { state: st, amplitude: amp } = stateRef.current;

      const speedMul =
        st === "thinking" ? 1.8 : st === "listening" ? 1.3 : st === "speaking" ? 2.4 : 1;
      const pulse =
        0.5 + 0.5 * Math.sin(t * (st === "speaking" ? 7 : st === "thinking" ? 4.5 : 1.6));
      const energy = pulse * (0.7 + amp * 0.6);

      ctx.clearRect(0, 0, size, size);

      // ---- ambient halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 2.2);
      halo.addColorStop(0, `hsla(${mood} / ${0.35 + energy * 0.25})`);
      halo.addColorStop(0.45, `hsla(${mood} / 0.08)`);
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      // ---- rings (3D-ish via affine transforms)
      ctx.save();
      ctx.translate(cx, cy);
      rings.forEach((ring, i) => {
        const ang = t * ring.speed * speedMul;
        ctx.save();
        ctx.rotate(i * 0.4);
        ctx.transform(
          Math.cos(ring.tilt),
          Math.sin(ring.tilt) * 0.25,
          -Math.sin(ang) * 0.4,
          Math.cos(ang),
          0,
          0,
        );
        ctx.beginPath();
        ctx.ellipse(0, 0, R * ring.r, R * ring.r * (0.95 - Math.abs(ring.tilt) * 0.15), 0, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${mood} / ${0.55 + energy * 0.3})`;
        ctx.lineWidth = 1.1;
        if (ring.dash) ctx.setLineDash([2, 6]);
        else ctx.setLineDash([]);
        ctx.shadowColor = `hsl(${mood})`;
        ctx.shadowBlur = 10;
        ctx.stroke();

        // tick marks on the big ring
        if (i === 0) {
          for (let k = 0; k < 48; k++) {
            const a = (k / 48) * Math.PI * 2 + ang * 1.2;
            const inner = k % 4 === 0 ? R * 0.86 : R * 0.9;
            const outer = R * 0.97;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
            ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
            ctx.strokeStyle = `hsla(${mood} / ${k % 4 === 0 ? 0.95 : 0.45})`;
            ctx.lineWidth = k % 4 === 0 ? 1.2 : 0.7;
            ctx.stroke();
          }
        }
        ctx.restore();
      });
      ctx.restore();

      // ---- particle sphere (rotating)
      const rotY = t * 0.45 * speedMul;
      const rotX = Math.sin(t * 0.3) * 0.4;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // sort by z to fake depth
      const proj: { x: number; y: number; z: number; s: number; tw: number }[] = [];
      for (const p of particles) {
        // rotate Y
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        // rotate X
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;
        proj.push({ x: x1, y: y1, z: z2, s: p.s, tw: p.tw });
      }
      proj.sort((a, b) => a.z - b.z);

      for (const p of proj) {
        const depth = (p.z + 1) / 2; // 0 back, 1 front
        const px = cx + p.x * R;
        const py = cy + p.y * R;
        const fres = 0.25 + Math.pow(1 - depth, 1.6) * 0.9; // rim glow
        const tw = 0.6 + 0.4 * Math.sin(t * 3 + p.tw);
        const r = (0.6 + p.s * 0.9) * (0.6 + depth * 0.8);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${mood} / ${(fres + tw * 0.15) * (0.55 + energy * 0.4)})`;
        ctx.fill();
      }

      // ---- inner core (radial)
      const core = ctx.createRadialGradient(cx - R * 0.18, cy - R * 0.22, 2, cx, cy, R * 0.92);
      core.addColorStop(0, `hsla(${mood} / ${0.85 + energy * 0.15})`);
      core.addColorStop(0.35, `hsla(${mood} / ${0.32 + energy * 0.2})`);
      core.addColorStop(0.8, `hsla(${mood} / 0.05)`);
      core.addColorStop(1, "transparent");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
      ctx.fill();

      // specular
      ctx.beginPath();
      ctx.ellipse(cx - R * 0.22, cy - R * 0.28, R * 0.22, R * 0.12, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.18 + energy * 0.1})`;
      ctx.filter = "blur(6px)";
      ctx.fill();
      ctx.filter = "none";

      // orbiters
      orbiters.forEach((o) => {
        const a = t * o.speed * speedMul + o.phase;
        const rad = R * 1.05;
        const ox = cx + Math.cos(a) * rad;
        const oy = cy + Math.sin(a) * rad * Math.cos(o.tilt);
        ctx.beginPath();
        ctx.arc(ox, oy, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${mood} / 0.95)`;
        ctx.shadowColor = `hsl(${mood})`;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // speaking equator FFT
      if (st === "speaking") {
        ctx.save();
        ctx.translate(cx, cy);
        for (let k = 0; k < 56; k++) {
          const a = (k / 56) * Math.PI * 2;
          const len =
            R * (0.05 + Math.abs(Math.sin(t * 6 + k * 0.7) + Math.sin(t * 11 + k)) * (0.06 + amp * 0.18));
          const x1 = Math.cos(a) * R * 0.98;
          const y1 = Math.sin(a) * R * 0.98;
          const x2 = Math.cos(a) * (R * 0.98 + len);
          const y2 = Math.sin(a) * (R * 0.98 + len);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `hsla(${mood} / 0.85)`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.restore();
      }

      // listening scan
      if (st === "listening") {
        const y = cy - R + ((t * 220) % (R * 2));
        const g = ctx.createLinearGradient(cx - R, y, cx + R, y);
        g.addColorStop(0, "transparent");
        g.addColorStop(0.5, `hsla(${mood} / 0.85)`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, y - 0.5, R * 2, 1.4);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(moodPoll);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={cn("block", className)}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
