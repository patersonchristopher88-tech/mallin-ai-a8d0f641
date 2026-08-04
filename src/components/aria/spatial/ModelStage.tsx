import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Layers, Pause, Play, Eye, EyeOff, RotateCw, Sparkles, Loader2 } from "lucide-react";
import {
  buildModel,
  buildModelFromSpec,
  resolveModelKey,
  type ModelDef,
  type ModelPart,
  type ModelSpec,
} from "@/lib/aria/spatial/models";
import { spatialCall } from "@/components/aria/spatial/panels";
import { cn } from "@/lib/utils";

interface Props {
  query: string;
  explodeSignal: number;
  collapseSignal: number;
  onExplain: (partName: string, modelTitle: string, desc: string) => void;
}

/**
 * Interactive holographic 3D stage: orbit / pinch-zoom, exploded view,
 * part isolation, labels, animation + speed controls.
 */
export function ModelStage({ query, explodeSignal, collapseSignal, onExplain }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [explode, setExplode] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [labels, setLabels] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const fallback: ModelDef = useMemo(() => buildModel(query), [query]);
  const [model, setModel] = useState<ModelDef>(fallback);

  // Anything outside the hand-built catalog is designed on the fly by ARIA.
  useEffect(() => {
    setModel(fallback);
    setSelected(null);
    setHidden(new Set());
    if (resolveModelKey(query) !== "generic") return;
    let cancelled = false;
    setGenerating(true);
    spatialCall<{ spec: ModelSpec }>({ action: "model-spec", query })
      .then((d) => {
        if (cancelled || !d?.spec?.parts?.length) return;
        setModel(buildModelFromSpec(d.spec, query));
      })
      .catch(() => {
        /* keep procedural fallback */
      })
      .finally(() => {
        if (!cancelled) setGenerating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fallback, query]);

  const stateRef = useRef({ explode, animate, speed, selected, hidden });
  stateRef.current = { explode, animate, speed, selected, hidden };

  useEffect(() => {
    if (explodeSignal > 0) setExplode(1);
  }, [explodeSignal]);
  useEffect(() => {
    if (collapseSignal > 0) setExplode(0);
  }, [collapseSignal]);


  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    let dist = 5.2;
    let yaw = 0.6;
    let pitch = 0.35;

    scene.add(new THREE.AmbientLight(0x88ccff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x22e1ff, 2.4, 20);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    scene.add(model.root);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ---- pointer orbit / zoom
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let moved = false;

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      }
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.hypot(dx, dy) > 2) moved = true;
      if (pointers.size === 1) {
        yaw -= dx * 0.007;
        pitch = Math.max(-1.3, Math.min(1.3, pitch - dy * 0.007));
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart) dist = Math.max(1.8, Math.min(14, dist * (pinchStart / d)));
        pinchStart = d;
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinchStart = 0;
      if (!moved) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(model.root.children, true);
        const hit = hits.find((h) => {
          let o: THREE.Object3D | null = h.object;
          while (o && !o.userData.partId) o = o.parent;
          return !!o && !h.object.userData.decor;
        });
        if (hit) {
          let o: THREE.Object3D | null = hit.object;
          while (o && !o.userData.partId) o = o.parent;
          const pid = o?.userData.partId as string | undefined;
          if (pid) {
            const p = model.parts.find((x) => x.id === pid);
            setSelected((s) => (s === pid ? null : pid));
            if (p) onExplain(p.name, model.title, p.desc);
          }
        } else {
          setSelected(null);
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      dist = Math.max(1.8, Math.min(14, dist * Math.exp(dy * 0.0015)));
    };

    const el = renderer.domElement;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    const t0 = performance.now();
    let raf = 0;
    const originalMats = new Map<string, THREE.Material | THREE.Material[]>();

    const applyPartState = (p: ModelPart, s: typeof stateRef.current) => {
      const target = p.base.clone().addScaledVector(p.dir, s.explode * 0.55);
      p.obj.position.lerp(target, 0.12);
      p.obj.visible = !s.hidden.has(p.id);
      p.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.material) return;
        const key = m.uuid;
        if (!originalMats.has(key)) originalMats.set(key, m.material);
        const isSel = s.selected === p.id;
        const dim = !!s.selected && !isSel;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mm) => {
          const mat = mm as THREE.Material & { emissive?: THREE.Color; opacity: number };
          mat.transparent = true;
          mat.opacity = dim ? 0.18 : mat.userData?.baseOpacity ?? 1;
          if (mat.emissive) mat.emissive.setHex(isSel ? 0x1188aa : 0x000000);
        });
      });
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = (performance.now() - t0) / 1000;
      const s = stateRef.current;
      model.update?.(t, { animate: s.animate, speed: s.speed });
      model.parts.forEach((p) => applyPartState(p, s));
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
    };
  }, [model, onExplain]);

  const sel = model.parts.find((p) => p.id === selected);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="relative flex-1 overflow-hidden rounded-xl border border-primary/20 bg-black/40">
        <div ref={mountRef} className="absolute inset-0" />
        {labels && (
          <div className="pointer-events-none absolute left-2 top-2 max-w-[55%] space-y-1">
            <p className="font-display text-xs uppercase tracking-[0.25em] text-primary">{model.title}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{model.subtitle}</p>
            {sel && (
              <p className="mt-1 rounded border border-primary/40 bg-background/70 px-2 py-1 font-mono text-[10px] text-foreground">
                {sel.name}
              </p>
            )}
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 right-2 font-mono text-[9px] uppercase tracking-widest text-primary/60">
          drag · orbit / pinch · zoom / tap · inspect
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Ctl onClick={() => setExplode((e) => (e > 0.5 ? 0 : 1))} active={explode > 0.5} Icon={Layers}>
          {explode > 0.5 ? "Assemble" : "Explode"}
        </Ctl>
        <Ctl onClick={() => setAnimate((a) => !a)} active={animate} Icon={animate ? Pause : Play}>
          {animate ? "Freeze" : "Animate"}
        </Ctl>
        <Ctl onClick={() => setLabels((l) => !l)} active={labels} Icon={labels ? Eye : EyeOff}>
          Labels
        </Ctl>
        <Ctl onClick={() => setSpeed((s) => (s >= 2 ? 0.25 : s * 2))} Icon={RotateCw}>
          {speed}×
        </Ctl>
        {sel && (
          <Ctl
            onClick={() =>
              setHidden((h) => {
                const n = new Set(h);
                if (n.has(sel.id)) n.delete(sel.id);
                else n.add(sel.id);
                return n;
              })
            }
            active={hidden.has(sel.id)}
            Icon={EyeOff}
          >
            {hidden.has(sel.id) ? "Show part" : "Hide part"}
          </Ctl>
        )}
        {sel && (
          <Ctl onClick={() => onExplain(sel.name, model.title, sel.desc)} Icon={Sparkles}>
            Explain
          </Ctl>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {model.parts.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelected((s) => (s === p.id ? null : p.id));
              onExplain(p.name, model.title, p.desc);
            }}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-[10px] transition",
              selected === p.id
                ? "border-primary bg-primary/20 text-primary"
                : "border-primary/25 text-muted-foreground hover:border-primary/60 hover:text-primary",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {sel && <p className="text-xs leading-relaxed text-muted-foreground">{sel.desc}</p>}
    </div>
  );
}

function Ctl({
  children,
  onClick,
  active,
  Icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-display text-[10px] uppercase tracking-widest transition",
        active
          ? "border-primary bg-primary/20 text-primary"
          : "border-primary/25 text-muted-foreground hover:border-primary/60 hover:text-primary",
      )}
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}
