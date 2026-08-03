import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValue, animate } from "motion/react";
import { Lock, Maximize2, Pin, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PanelTransform {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  z: number;
  locked: boolean;
  pinned: boolean;
}

interface Props {
  id: string;
  title: string;
  subtitle?: string;
  transform: PanelTransform;
  focused: boolean;
  children: ReactNode;
  onChange: (id: string, patch: Partial<PanelTransform>) => void;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
}

/**
 * Floating holographic panel: drag with momentum + snap, corner resize,
 * rotate handle, lock/pin, and a fling-to-dismiss gesture.
 */
export function HoloPanel({
  id,
  title,
  subtitle,
  transform,
  focused,
  children,
  onChange,
  onClose,
  onFocus,
}: Props) {
  const x = useMotionValue(transform.x);
  const y = useMotionValue(transform.y);
  const [dragging, setDragging] = useState(false);
  const resizeRef = useRef<{ w: number; h: number; px: number; py: number } | null>(null);
  const rotRef = useRef<{ start: number; rot: number; cx: number; cy: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (dragging) return;
    animate(x, transform.x, { type: "spring", stiffness: 260, damping: 26 });
    animate(y, transform.y, { type: "spring", stiffness: 260, damping: 26 });
  }, [transform.x, transform.y, dragging, x, y]);

  // Resize via corner handle
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (resizeRef.current) {
        const r = resizeRef.current;
        onChange(id, {
          w: Math.max(220, Math.min(1400, r.w + (e.clientX - r.px))),
          h: Math.max(180, Math.min(1000, r.h + (e.clientY - r.py))),
        });
      }
      if (rotRef.current) {
        const r = rotRef.current;
        const a = Math.atan2(e.clientY - r.cy, e.clientX - r.cx);
        onChange(id, { rot: r.rot + ((a - r.start) * 180) / Math.PI });
      }
    };
    const up = () => {
      resizeRef.current = null;
      rotRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [id, onChange]);

  return (
    <motion.div
      ref={wrapRef}
      className={cn(
        "absolute select-none rounded-2xl border backdrop-blur-xl",
        focused ? "border-primary/60" : "border-primary/25",
        transform.locked && "border-amber-400/60",
      )}
      style={{
        x,
        y,
        width: transform.w,
        height: transform.h,
        zIndex: transform.z,
        rotate: transform.rot,
        background:
          "linear-gradient(160deg, color-mix(in oklab, var(--card) 78%, transparent), color-mix(in oklab, var(--background) 88%, transparent))",
        boxShadow: focused
          ? "0 0 0 1px hsl(var(--mood) / 0.25), 0 28px 90px -30px hsl(var(--mood) / 0.55)"
          : "0 18px 60px -34px hsl(var(--mood) / 0.4)",
      }}
      initial={{ opacity: 0, scale: 0.86, filter: "blur(14px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(12px)" }}
      transition={{ type: "spring", stiffness: 240, damping: 24 }}
      drag={!transform.locked}
      dragMomentum
      dragElastic={0.12}
      dragTransition={{ power: 0.28, timeConstant: 260, bounceStiffness: 320, bounceDamping: 26 }}
      onPointerDown={() => onFocus(id)}
      onDragStart={() => setDragging(true)}
      onDragEnd={(_e, info) => {
        setDragging(false);
        // Fling to dismiss
        if (Math.abs(info.velocity.x) > 1600 || Math.abs(info.velocity.y) > 1600) {
          if (!transform.pinned) {
            onClose(id);
            return;
          }
        }
        const snap = (v: number) => Math.round(v / 16) * 16;
        onChange(id, { x: snap(x.get()), y: snap(y.get()) });
      }}
      whileDrag={{ scale: 1.02 }}
    >
      {/* HUD corners */}
      <span className="pointer-events-none absolute -left-px -top-px h-4 w-4 rounded-tl-2xl border-l-2 border-t-2 border-primary/70" />
      <span className="pointer-events-none absolute -right-px -top-px h-4 w-4 rounded-tr-2xl border-r-2 border-t-2 border-primary/70" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-4 w-4 rounded-bl-2xl border-b-2 border-l-2 border-primary/70" />

      <header className="flex cursor-grab items-center gap-2 border-b border-primary/20 px-3 py-2 active:cursor-grabbing">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[11px] uppercase tracking-[0.25em] text-primary">{title}</p>
          {subtitle && <p className="truncate font-mono text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
        <button
          onClick={() => onChange(id, { pinned: !transform.pinned })}
          className={cn(
            "rounded p-1 transition",
            transform.pinned ? "text-amber-300" : "text-muted-foreground hover:text-primary",
          )}
          aria-label="Pin panel"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onChange(id, { locked: !transform.locked })}
          className={cn(
            "rounded p-1 transition",
            transform.locked ? "text-amber-300" : "text-muted-foreground hover:text-primary",
          )}
          aria-label="Lock panel"
        >
          <Lock className="h-3.5 w-3.5" />
        </button>
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            const rect = wrapRef.current?.getBoundingClientRect();
            if (!rect) return;
            rotRef.current = {
              start: Math.atan2(e.clientY - (rect.top + rect.height / 2), e.clientX - (rect.left + rect.width / 2)),
              rot: transform.rot,
              cx: rect.left + rect.width / 2,
              cy: rect.top + rect.height / 2,
            };
          }}
          className="rounded p-1 text-muted-foreground hover:text-primary"
          aria-label="Rotate panel"
        >
          <Maximize2 className="h-3.5 w-3.5 rotate-45" />
        </button>
        <button
          onClick={() => onClose(id)}
          className="rounded p-1 text-muted-foreground hover:text-destructive"
          aria-label="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="h-[calc(100%-42px)] overflow-auto overscroll-contain p-3">{children}</div>

      {/* resize handle */}
      <button
        onPointerDown={(e) => {
          e.stopPropagation();
          resizeRef.current = { w: transform.w, h: transform.h, px: e.clientX, py: e.clientY };
        }}
        className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize"
        aria-label="Resize panel"
      >
        <span className="absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-primary/70" />
      </button>
    </motion.div>
  );
}
