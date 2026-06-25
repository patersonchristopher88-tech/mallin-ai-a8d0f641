import { useEffect, useRef } from "react";

/**
 * Cinematic background: slow drifting blooms + animated noise + radar sweep.
 * Sits behind everything (z-0 fixed). Cheap on mobile.
 */
export function HudBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let w = window.innerWidth;
    let h = window.innerHeight;
    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const readMood = () =>
      getComputedStyle(document.documentElement).getPropertyValue("--mood").trim() ||
      "188 100% 56%";
    let mood = readMood();
    const moodPoll = setInterval(() => (mood = readMood()), 400);

    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.2,
      tw: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, w, h);

      // drifting blooms
      for (let i = 0; i < 3; i++) {
        const bx = w * (0.5 + Math.cos(t * 0.07 + i * 2) * 0.4);
        const by = h * (0.5 + Math.sin(t * 0.05 + i * 1.5) * 0.4);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, Math.max(w, h) * 0.45);
        g.addColorStop(0, `hsla(${mood} / ${0.09 - i * 0.02})`);
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // stars
      for (const s of stars) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${mood} / ${a * 0.55})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      clearInterval(moodPoll);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
