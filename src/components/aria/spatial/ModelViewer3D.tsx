import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Loader2 } from "lucide-react";
import type { Model3DDiagnostics, ModelOp } from "@/lib/aria/spatial/model3d";

interface Props {
  url: string;
  /** Latest spatial command; bump `nonce` to re-apply the same op. */
  command?: { op: ModelOp; nonce: number } | null;
  onDiagnostics?: (d: Model3DDiagnostics) => void;
  onError?: (message: string) => void;
  onSelect?: (name: string | null) => void;
}

const VIEWS: Record<string, [number, number, number]> = {
  front: [0, 0.4, 3.2],
  rear: [0, 0.4, -3.2],
  left: [-3.2, 0.4, 0],
  right: [3.2, 0.4, 0],
  top: [0, 3.4, 0.001],
};

function Asset({
  url,
  groupRef,
  onDiagnostics,
  onSelect,
  isolate,
  wireframe,
  selected,
}: {
  url: string;
  groupRef: React.RefObject<THREE.Group | null>;
  onDiagnostics?: (d: Model3DDiagnostics) => void;
  onSelect?: (name: string | null) => void;
  isolate: boolean;
  wireframe: boolean;
  selected: string | null;
}) {
  const gltf = useGLTF(url);

  // Clone so repeated mounts never mutate the cached asset.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  // Normalise scale + centre the pivot so every generated asset lands the same size.
  const fitted = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2 / maxDim;
    return {
      scale,
      offset: new THREE.Vector3(-centre.x * scale, -box.min.y * scale, -centre.z * scale),
    };
  }, [scene]);

  useEffect(() => {
    let triangles = 0;
    let meshes = 0;
    const materials = new Set<string>();
    const textures = new Set<string>();
    let materialsOk = true;

    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      m.castShadow = true;
      m.receiveShadow = true;
      const geo = m.geometry as THREE.BufferGeometry;
      const idx = geo.index?.count ?? geo.attributes.position?.count ?? 0;
      triangles += Math.floor(idx / 3);
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mm) => {
        if (!mm) {
          materialsOk = false;
          return;
        }
        materials.add(mm.uuid);
        const std = mm as THREE.MeshStandardMaterial;
        // Rebuild broken/flat materials so exports without PBR still read as solid.
        if (std.isMeshStandardMaterial) {
          if (std.map) textures.add(std.map.uuid);
          if (std.normalMap) textures.add(std.normalMap.uuid);
          if (std.roughnessMap) textures.add(std.roughnessMap.uuid);
          if (!std.map && (std.color.r + std.color.g + std.color.b === 0)) std.color.set("#9fb4c7");
          if (std.roughness === 1 && !std.roughnessMap) std.roughness = 0.65;
          std.envMapIntensity = 1.1;
          std.needsUpdate = true;
        }
      });
    });

    onDiagnostics?.({
      triangles,
      meshes,
      materials: materials.size,
      textures: textures.size,
      materialsOk,
      texturesOk: textures.size > 0,
      rendererError: null,
    });
  }, [scene, onDiagnostics]);

  // Isolation + wireframe passes.
  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.visible = !isolate || !selected || m.name === selected;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mm) => {
        const std = mm as THREE.MeshStandardMaterial;
        if (std && "wireframe" in std) std.wireframe = wireframe;
      });
    });
  }, [scene, isolate, wireframe, selected]);

  return (
    <group ref={groupRef}>
      <primitive
        object={scene}
        scale={fitted.scale}
        position={fitted.offset}
        onPointerDown={(e: { object: THREE.Object3D; stopPropagation: () => void }) => {
          e.stopPropagation();
          onSelect?.(e.object.name || null);
        }}
      />
    </group>
  );
}

function Fallback() {
  return (
    <mesh>
      <icosahedronGeometry args={[0.9, 1]} />
      <meshStandardMaterial color="#22e1ff" wireframe transparent opacity={0.35} />
    </mesh>
  );
}

/** Photoreal-ish GLB viewer: PBR, in-scene HDR lighting, shadows, orbit controls, voice-driven ops. */
export function ModelViewer3D({ url, command, onDiagnostics, onError, onSelect }: Props) {
  const groupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [mounted, setMounted] = useState(false);
  const [spin, setSpin] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Apply the latest spatial/voice command.
  useEffect(() => {
    if (!command) return;
    const g = groupRef.current;
    const c = controlsRef.current;
    const op = command.op;
    if (op.op === "scale" && g) g.scale.multiplyScalar(op.factor);
    if (op.op === "rotate" && g) {
      const rad = (op.deg * Math.PI) / 180;
      if (op.axis === "y") g.rotation.y += rad;
      else g.rotation.x += rad;
    }
    if (op.op === "spin") setSpin(op.on);
    if (op.op === "wireframe") setWireframe((w) => !w);
    if (op.op === "isolate") setIsolate((i) => !i);
    if (op.op === "reset") {
      if (g) {
        g.scale.setScalar(1);
        g.rotation.set(0, 0, 0);
      }
      c?.reset();
    }
    if (op.op === "focus" || op.op === "view") {
      const p = op.op === "view" ? VIEWS[op.side] : VIEWS.front;
      if (c && p) {
        c.object.position.set(p[0], p[1], p[2]);
        c.target.set(0, 0.9, 0);
        c.update();
      }
    }
  }, [command]);

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center gap-2 font-mono text-[11px] text-primary/70">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> initialising renderer
      </div>
    );
  }

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [2.4, 1.8, 3.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", () =>
          onError?.("WebGL context lost — rendering paused."),
        );
      }}
      style={{ touchAction: "none" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 2, -3]} intensity={12} color="#22e1ff" distance={14} />

      <Suspense fallback={<Fallback />}>
        <Asset
          url={url}
          groupRef={groupRef}
          onDiagnostics={onDiagnostics}
          onSelect={(n) => {
            setSelected(n);
            onSelect?.(n);
          }}
          isolate={isolate}
          wireframe={wireframe}
          selected={selected}
        />
        {/* File-free HDR environment so PBR materials always have something to reflect. */}
        <Environment resolution={128} frames={1}>
          <Lightformer intensity={3} position={[0, 4, -6]} scale={[12, 12, 1]} color="#bfe9ff" />
          <Lightformer intensity={1.6} position={[-6, 2, 3]} scale={[8, 8, 1]} color="#5fa8ff" />
          <Lightformer intensity={1.2} position={[6, -2, 3]} scale={[8, 8, 1]} color="#ffffff" />
        </Environment>
      </Suspense>

      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={12} blur={2.4} far={4} color="#020a12" />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={spin}
        autoRotateSpeed={0.9}
        minDistance={1.2}
        maxDistance={12}
        target={[0, 0.9, 0]}
      />
    </Canvas>
  );
}
