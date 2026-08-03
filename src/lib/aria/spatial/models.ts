import * as THREE from "three";

export interface ModelPart {
  id: string;
  name: string;
  desc: string;
  obj: THREE.Object3D;
  base: THREE.Vector3;
  dir: THREE.Vector3;
}

export interface ModelDef {
  key: string;
  title: string;
  subtitle: string;
  parts: ModelPart[];
  root: THREE.Group;
  /** per-frame animation, t in seconds, speed multiplier */
  update?: (t: number, opts: { animate: boolean; speed: number }) => void;
}

const CY = 0x22e1ff;
const AM = 0xffb547;

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.35,
    roughness: 0.35,
    ...opts,
  });
}

function wire(color = CY, opacity = 0.35) {
  return new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity });
}

function part(
  parts: ModelPart[],
  root: THREE.Group,
  id: string,
  name: string,
  desc: string,
  obj: THREE.Object3D,
  dir: [number, number, number],
) {
  obj.name = id;
  obj.userData.partId = id;
  root.add(obj);
  parts.push({
    id,
    name,
    desc,
    obj,
    base: obj.position.clone(),
    dir: new THREE.Vector3(...dir),
  });
  return obj;
}

/* ------------------------------------------------------------------ planets */

function planet(
  key: string,
  title: string,
  subtitle: string,
  color: number,
  opts: { rings?: boolean; moon?: boolean; atmosphere?: boolean; radius?: number } = {},
): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];
  const R = opts.radius ?? 1;

  const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.35, 32, 32), mat(0xff5a3c, { emissive: 0x551100 }));
  part(parts, root, "core", "Core", "The dense metallic centre. Extreme pressure and heat drive the magnetic field.", core, [0, -1.6, 0]);

  const mantle = new THREE.Mesh(new THREE.SphereGeometry(R * 0.7, 32, 32), mat(0xcc6633, { transparent: true, opacity: 0.65 }));
  part(parts, root, "mantle", "Mantle", "Slow-flowing rock that carries heat outward and drives surface movement.", mantle, [1.6, 0.4, 0]);

  const crust = new THREE.Mesh(
    new THREE.SphereGeometry(R, 48, 48),
    mat(color, { roughness: 0.8, metalness: 0.05 }),
  );
  part(parts, root, "surface", "Surface", "The visible outer shell — terrain, oceans and ice.", crust, [-1.6, 0.4, 0]);

  const grid = new THREE.Mesh(new THREE.SphereGeometry(R * 1.005, 24, 18), wire(CY, 0.22));
  grid.userData.decor = true;
  root.add(grid);

  if (opts.atmosphere) {
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.12, 32, 32),
      new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.12, side: THREE.BackSide }),
    );
    part(parts, root, "atmosphere", "Atmosphere", "Gas envelope that scatters light, holds weather and shields the surface.", atmo, [0, 1.8, 0]);
  }

  if (opts.rings) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(R * 1.5, R * 2.3, 96),
      new THREE.MeshBasicMaterial({ color: AM, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = Math.PI / 2.3;
    part(parts, root, "rings", "Ring system", "Billions of ice and rock fragments in orbit, shepherded by small moons.", ring, [0, 0.2, 1.8]);
  }

  let moonPivot: THREE.Object3D | null = null;
  if (opts.moon) {
    moonPivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(R * 0.27, 24, 24), mat(0xaaaaaa, { roughness: 1 }));
    m.position.set(R * 2.6, 0, 0);
    moonPivot.add(m);
    part(parts, root, "moon", "Moon", "A tidally-locked satellite that stabilises axial tilt and drives tides.", moonPivot, [0, 0, -2.2]);
  }

  return {
    key,
    title,
    subtitle,
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      crust.rotation.y = t * 0.25 * o.speed;
      grid.rotation.y = t * 0.25 * o.speed;
      mantle.rotation.y = t * 0.18 * o.speed;
      if (moonPivot) moonPivot.rotation.y = t * 0.35 * o.speed;
    },
  };
}

/* ------------------------------------------------------------- solar system */

function solarSystem(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb040 }),
  );
  part(parts, root, "sun", "Sun", "A G-type star holding the system together; fusion in its core powers everything.", sun, [0, 1.6, 0]);

  const defs = [
    ["mercury", "Mercury", 0.09, 1.0, 1.6, 0x9a8f88],
    ["venus", "Venus", 0.14, 1.45, 1.2, 0xd9a441],
    ["earth", "Earth", 0.15, 1.95, 1.0, 0x2f7fd6],
    ["mars", "Mars", 0.12, 2.5, 0.8, 0xc1440e],
    ["jupiter", "Jupiter", 0.32, 3.3, 0.45, 0xd0a374],
    ["saturn", "Saturn", 0.28, 4.2, 0.32, 0xe3c98d],
  ] as const;

  const pivots: { pivot: THREE.Object3D; speed: number; body: THREE.Mesh }[] = [];

  for (const [id, name, r, dist, speed, color] of defs) {
    const pivot = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), mat(color, { roughness: 0.8 }));
    body.position.set(dist, 0, 0);
    pivot.add(body);

    const orbit = new THREE.Mesh(
      new THREE.RingGeometry(dist - 0.006, dist + 0.006, 128),
      new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    );
    orbit.rotation.x = Math.PI / 2;
    orbit.userData.decor = true;
    root.add(orbit);

    if (id === "saturn") {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r * 1.5, r * 2.4, 64),
        new THREE.MeshBasicMaterial({ color: AM, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = Math.PI / 2.3;
      body.add(ring);
    }

    part(parts, root, id, name, `${name} orbits at ${dist.toFixed(1)} scaled AU. Select it to isolate its orbit.`, pivot, [0, 0.9, 0]);
    pivots.push({ pivot, speed, body });
  }

  return {
    key: "solar",
    title: "Solar System",
    subtitle: "Orbits · rotation · time controls",
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      for (const p of pivots) {
        p.pivot.rotation.y = t * p.speed * 0.35 * o.speed;
        p.body.rotation.y = t * 1.2 * o.speed;
      }
    },
  };
}

/* -------------------------------------------------------------------- heart */

function heart(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const mk = (w: number, h: number, d: number, color: number) =>
    new THREE.Mesh(new THREE.SphereGeometry(1, 24, 20).scale(w, h, d), mat(color, { roughness: 0.5 }));

  const la = mk(0.42, 0.36, 0.4, 0xff5f7a);
  la.position.set(-0.45, 0.55, 0);
  part(parts, root, "la", "Left atrium", "Receives oxygen-rich blood from the lungs and passes it to the left ventricle.", la, [-1.1, 0.8, 0]);

  const ra = mk(0.42, 0.36, 0.4, 0x4f7fff);
  ra.position.set(0.45, 0.55, 0);
  part(parts, root, "ra", "Right atrium", "Collects deoxygenated blood returning from the body via the vena cava.", ra, [1.1, 0.8, 0]);

  const lv = mk(0.5, 0.62, 0.46, 0xe23f5c);
  lv.position.set(-0.32, -0.3, 0);
  part(parts, root, "lv", "Left ventricle", "The strongest chamber — pumps oxygenated blood into the aorta and out to the body.", lv, [-1.3, -0.7, 0]);

  const rv = mk(0.46, 0.58, 0.44, 0x3a63d8);
  rv.position.set(0.34, -0.32, 0);
  part(parts, root, "rv", "Right ventricle", "Pushes deoxygenated blood through the pulmonary artery to the lungs.", rv, [1.3, -0.7, 0]);

  const aorta = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.11, 16, 48, Math.PI * 1.2), mat(0xff8080));
  aorta.position.set(-0.2, 1.05, 0);
  aorta.rotation.z = -0.4;
  part(parts, root, "aorta", "Aorta", "The body's largest artery, carrying oxygenated blood away from the left ventricle.", aorta, [0, 1.8, 0]);

  const pulm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 16), mat(0x6fa0ff));
  pulm.position.set(0.5, 1.05, -0.1);
  pulm.rotation.z = 0.4;
  part(parts, root, "pulmonary", "Pulmonary artery", "Carries deoxygenated blood from the right ventricle to the lungs.", pulm, [1.2, 1.6, 0]);

  const valves = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const v = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 10, 24), mat(AM, { emissive: 0x442200 }));
    v.position.set(i % 2 === 0 ? -0.36 : 0.4, i < 2 ? 0.16 : 0.1, 0.2);
    v.rotation.x = Math.PI / 2;
    valves.add(v);
  }
  part(parts, root, "valves", "Valves", "One-way gates (mitral, tricuspid, aortic, pulmonary) that stop backflow between beats.", valves, [0, 0, 1.8]);

  // blood-flow particles
  const flowGeo = new THREE.BufferGeometry();
  const COUNT = 160;
  const positions = new Float32Array(COUNT * 3);
  flowGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const flow = new THREE.Points(
    flowGeo,
    new THREE.PointsMaterial({ color: CY, size: 0.05, transparent: true, opacity: 0.9 }),
  );
  flow.userData.decor = true;
  flow.name = "__flow";
  root.add(flow);

  return {
    key: "heart",
    title: "Human Heart",
    subtitle: "Chambers · valves · blood flow",
    parts,
    root,
    update: (t, o) => {
      const beat = o.animate ? 1 + Math.pow(Math.max(0, Math.sin(t * 2.2 * o.speed)), 8) * 0.08 : 1;
      root.scale.setScalar(beat);
      const pos = flowGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        const phase = (t * 0.25 * o.speed + i / COUNT) % 1;
        const a = phase * Math.PI * 2;
        const loop = i % 2 === 0 ? 1 : -1;
        pos.setXYZ(
          i,
          Math.sin(a) * 0.75 * loop,
          Math.cos(a) * 0.85 + 0.1,
          Math.sin(a * 2) * 0.25,
        );
      }
      pos.needsUpdate = true;
      flow.visible = o.animate;
    },
  };
}

/* ------------------------------------------------------------------- engine */

function v8Engine(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), mat(0x6c7a86));
  part(parts, root, "block", "Engine block", "The cast structural core holding the cylinders, crankshaft and coolant galleries.", block, [0, -1.4, 0]);

  const heads = new THREE.Group();
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.3, 1.2), mat(0x8b98a5));
    h.position.set(s * 0.48, 0.62, 0);
    h.rotation.z = s * 0.3;
    heads.add(h);
  }
  part(parts, root, "heads", "Cylinder heads", "Seal the cylinders and house valves, camshafts and the intake/exhaust ports.", heads, [0, 1.5, 0]);

  const cylinders = new THREE.Group();
  const pistons = new THREE.Group();
  const plugs = new THREE.Group();
  const pistonMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const bank = i < 4 ? -1 : 1;
    const idx = i % 4;
    const x = bank * 0.34;
    const z = -0.45 + idx * 0.3;

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.7, 20, 1, true), wire(CY, 0.5));
    cyl.position.set(x, 0.25, z);
    cyl.rotation.z = bank * 0.3;
    cylinders.add(cyl);

    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.2, 20), mat(0xd8dde2));
    p.position.set(x, 0.2, z);
    p.rotation.z = bank * 0.3;
    p.userData.phase = i * 0.78;
    pistons.add(p);
    pistonMeshes.push(p);

    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), mat(AM, { emissive: 0x442200 }));
    plug.position.set(x * 1.4, 0.72, z);
    plug.rotation.z = bank * 0.3;
    plugs.add(plug);
  }
  part(parts, root, "cylinders", "Cylinders", "Eight bores in a 90° V. Each is a sealed chamber where combustion happens.", cylinders, [0, 0.9, 0]);
  part(parts, root, "pistons", "Pistons", "Driven down by expanding gas, converting combustion pressure into linear motion.", pistons, [0, 0.5, 1.5]);
  part(parts, root, "plugs", "Spark plugs", "Fire a timed arc that ignites the compressed air-fuel mixture.", plugs, [0, 1.9, 0.4]);

  const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 16), mat(0xb0b8c0));
  crank.rotation.x = Math.PI / 2;
  crank.position.y = -0.42;
  part(parts, root, "crank", "Crankshaft", "Turns the pistons' linear strokes into rotation delivered to the gearbox.", crank, [0, -1.8, 0]);

  const fuel = new THREE.Group();
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 12), mat(0xff7043));
  rail.rotation.x = Math.PI / 2;
  rail.position.set(0, 0.95, 0);
  fuel.add(rail);
  for (let i = 0; i < 4; i++) {
    const inj = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 10), mat(0xff9070));
    inj.position.set(0, 0.82, -0.45 + i * 0.3);
    fuel.add(inj);
  }
  part(parts, root, "fuel", "Fuel system", "Rail and injectors atomise fuel into each intake charge at precise pressure.", fuel, [0, 2.3, 0]);

  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.1), mat(0x4b5563));
  intake.position.set(0, 1.25, 0);
  part(parts, root, "intake", "Intake manifold", "Distributes incoming air evenly to all eight cylinders.", intake, [0, 2.8, 0]);

  const exhaust = new THREE.Group();
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 20, Math.PI), mat(0x9aa4ae));
      pipe.position.set(s * 0.85, 0.35, -0.45 + i * 0.3);
      pipe.rotation.y = Math.PI / 2;
      pipe.rotation.z = s > 0 ? 0 : Math.PI;
      exhaust.add(pipe);
    }
  }
  part(parts, root, "exhaust", "Exhaust headers", "Scavenge burnt gases from each cylinder into the exhaust system.", exhaust, [0, 0.2, -2.2]);

  return {
    key: "engine",
    title: "V8 Engine",
    subtitle: "Assembly · exploded view · component inspection",
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      crank.rotation.y = t * 6 * o.speed;
      pistonMeshes.forEach((p) => {
        const ph = (p.userData.phase as number) + t * 6 * o.speed;
        const bank = p.position.x < 0 ? -1 : 1;
        const s = Math.sin(ph) * 0.14;
        p.position.y = 0.2 + s;
        p.position.x = bank * (0.34 + Math.abs(s) * 0.1 * bank);
      });
    },
  };
}

/* ------------------------------------------------------------------- rocket */

function rocket(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 24), mat(0xe7edf3));
  nose.position.y = 1.85;
  part(parts, root, "nose", "Payload fairing", "Aerodynamic shroud protecting the payload during ascent, jettisoned above the atmosphere.", nose, [0, 2.2, 0]);

  const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1, 24), mat(0xd3dbe3));
  s2.position.y = 0.95;
  part(parts, root, "stage2", "Second stage", "Vacuum-optimised stage that circularises the orbit after separation.", s2, [1.8, 0.8, 0]);

  const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.6, 24), mat(0xb9c3cc));
  s1.position.y = -0.4;
  part(parts, root, "stage1", "First stage", "Provides lift-off thrust and most of the delta-v through the dense lower atmosphere.", s1, [-1.9, -0.4, 0]);

  const engines = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const e = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16, 1, true), mat(0x8c959e, { side: THREE.DoubleSide }));
    e.position.set(i === 4 ? 0 : Math.cos(a) * 0.2, -1.35, i === 4 ? 0 : Math.sin(a) * 0.2);
    e.rotation.x = Math.PI;
    engines.add(e);
  }
  part(parts, root, "engines", "Engine cluster", "Gimballed bells burning cryogenic propellant to steer and accelerate the vehicle.", engines, [0, -2.2, 0]);

  const fins = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.35), mat(0x6b7784));
    const a = (i / 4) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.4, -1.05, Math.sin(a) * 0.4);
    f.rotation.y = -a;
    fins.add(f);
  }
  part(parts, root, "fins", "Grid fins", "Deploy during descent to steer the booster back for a controlled landing.", fins, [0, -1.2, 1.8]);

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.9, 16),
    new THREE.MeshBasicMaterial({ color: AM, transparent: true, opacity: 0.6 }),
  );
  flame.position.y = -1.95;
  flame.rotation.x = Math.PI;
  flame.userData.decor = true;
  root.add(flame);

  return {
    key: "rocket",
    title: "Orbital Launch Vehicle",
    subtitle: "Stages · engines · separation",
    parts,
    root,
    update: (t, o) => {
      flame.visible = o.animate;
      if (!o.animate) return;
      flame.scale.y = 1 + Math.sin(t * 24) * 0.18;
      root.position.y = Math.sin(t * 1.4 * o.speed) * 0.05;
    },
  };
}

/* ----------------------------------------------------------------- aircraft */

function aircraft(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const fuse = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.9, 8, 20), mat(0xdfe6ec));
  fuse.rotation.z = Math.PI / 2;
  part(parts, root, "fuselage", "Fuselage", "Pressurised tube carrying crew and payload; ties every other structure together.", fuse, [0, 1.6, 0]);

  const wings = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 2.9), mat(0xc3ccd4));
  wings.position.set(-0.1, -0.05, 0);
  part(parts, root, "wings", "Wings", "Generate lift; house fuel tanks, flaps, slats and spoilers.", wings, [0, 0.2, 2.2]);

  const tail = new THREE.Group();
  const vert = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.05), mat(0xa9b4bd));
  vert.position.set(-1.15, 0.36, 0);
  const horiz = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 1.1), mat(0xa9b4bd));
  horiz.position.set(-1.2, 0.05, 0);
  tail.add(vert, horiz);
  part(parts, root, "tail", "Empennage", "Vertical and horizontal stabilisers providing yaw and pitch stability.", tail, [-2, 0.8, 0]);

  const engines = new THREE.Group();
  const fans: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.5, 20, 1, true), mat(0x8e99a3, { side: THREE.DoubleSide }));
    nac.rotation.z = Math.PI / 2;
    nac.position.set(0.15, -0.22, s * 0.9);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.14, 12), wire(CY, 0.8));
    fan.rotation.y = Math.PI / 2;
    fan.position.set(0.4, -0.22, s * 0.9);
    fans.push(fan);
    engines.add(nac, fan);
  }
  part(parts, root, "engines", "Turbofans", "High-bypass engines: fan, compressor, combustor and turbine stages in series.", engines, [0, -1.5, 0]);

  const gear = new THREE.Group();
  for (const [x, z] of [[0.7, 0], [-0.2, 0.4], [-0.2, -0.4]] as const) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), mat(0x77828c));
    strut.position.set(x, -0.4, z);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.035, 8, 16), mat(0x333a41));
    wheel.position.set(x, -0.58, z);
    wheel.rotation.y = Math.PI / 2;
    gear.add(strut, wheel);
  }
  part(parts, root, "gear", "Landing gear", "Retractable oleo struts and brakes absorbing touchdown loads.", gear, [0, -2, 0]);

  return {
    key: "aircraft",
    title: "Airliner",
    subtitle: "Airframe · propulsion · control surfaces",
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      fans.forEach((f) => (f.rotation.x = t * 12 * o.speed));
      root.rotation.z = Math.sin(t * 0.7 * o.speed) * 0.06;
    },
  };
}

/* ----------------------------------------------------------------- computer */

function computer(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 1.6), mat(0x4b545c));
  chassis.position.y = -0.5;
  part(parts, root, "chassis", "Chassis", "Structural frame and airflow path for the whole system.", chassis, [0, -1.6, 0]);

  const mobo = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.4), mat(0x1f6d4a));
  mobo.position.y = -0.38;
  part(parts, root, "motherboard", "Motherboard", "Fibreglass PCB routing power and high-speed lanes between every component.", mobo, [0, -0.9, 0]);

  const cpu = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), mat(0xc9d2da, { metalness: 0.9 }));
  cpu.position.set(-0.3, -0.3, 0);
  part(parts, root, "cpu", "CPU", "Executes instructions; billions of transistors across several cores and cache levels.", cpu, [-1.2, 0.9, 0]);

  const cooler = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.02), mat(0xd9e0e6));
    fin.position.set(-0.3, -0.1, -0.18 + i * 0.04);
    cooler.add(fin);
  }
  part(parts, root, "cooler", "Cooler", "Heatsink and fan moving thermal energy away from the die.", cooler, [0, 1.7, 0]);

  const ram = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.9), mat(0x2b3d55));
    stick.position.set(0.15 + i * 0.09, -0.14, 0);
    ram.add(stick);
  }
  part(parts, root, "ram", "Memory", "Volatile DRAM holding running programs and data close to the CPU.", ram, [1.5, 0.7, 0]);

  const gpu = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.5), mat(0x24303c));
  gpu.position.set(0, -0.05, 0.5);
  part(parts, root, "gpu", "GPU", "Massively parallel processor for graphics and tensor workloads.", gpu, [0, 0.4, 2]);

  const psu = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.55), mat(0x39424a));
  psu.position.set(0.65, -0.28, -0.45);
  part(parts, root, "psu", "Power supply", "Converts mains AC into regulated 12V/5V/3.3V rails.", psu, [2, -0.6, -1]);

  const storage = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.16), mat(0x6f7a85));
  storage.position.set(-0.55, -0.3, 0.5);
  part(parts, root, "storage", "NVMe storage", "Non-volatile flash on a PCIe lane for persistent, low-latency data.", storage, [-1.8, 0.2, 1.4]);

  return {
    key: "computer",
    title: "Workstation",
    subtitle: "Exploded hardware assembly",
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      root.rotation.y = t * 0.2 * o.speed;
    },
  };
}

/* --------------------------------------------------------------------- atom */

function atom(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const nucleus = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const n = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 16, 16),
      mat(i % 2 ? 0xff5a6e : 0x4f8bff, { emissive: i % 2 ? 0x330011 : 0x001133 }),
    );
    n.position.set((Math.random() - 0.5) * 0.34, (Math.random() - 0.5) * 0.34, (Math.random() - 0.5) * 0.34);
    nucleus.add(n);
  }
  part(parts, root, "nucleus", "Nucleus", "Protons and neutrons bound by the strong force; holds nearly all the atom's mass.", nucleus, [0, 1.6, 0]);

  const shells: THREE.Object3D[] = [];
  for (let s = 0; s < 3; s++) {
    const shell = new THREE.Group();
    const r = 0.9 + s * 0.5;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.006, 8, 96),
      new THREE.MeshBasicMaterial({ color: CY, transparent: true, opacity: 0.35 }),
    );
    shell.add(ring);
    for (let e = 0; e < s + 2; e++) {
      const el = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshBasicMaterial({ color: AM }));
      const a = (e / (s + 2)) * Math.PI * 2;
      el.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      shell.add(el);
    }
    shell.rotation.set(s * 0.9, s * 0.6, s * 0.4);
    part(parts, root, `shell${s + 1}`, `Electron shell ${s + 1}`, "A quantised energy level; electrons here define bonding behaviour.", shell, [0, 0, 0]);
    shells.push(shell);
  }

  return {
    key: "atom",
    title: "Atomic Structure",
    subtitle: "Nucleus · electron shells",
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      shells.forEach((s, i) => (s.rotation.z = t * (0.8 - i * 0.2) * o.speed));
      nucleus.rotation.y = t * 0.6 * o.speed;
    },
  };
}

/* --------------------------------------------------------------- rugby scrum */

function scrum(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshStandardMaterial({ color: 0x0d3a22, roughness: 1 }),
  );
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.y = -0.62;
  pitch.userData.decor = true;
  root.add(pitch);

  const grid = new THREE.GridHelper(7, 14, CY, 0x114455);
  (grid.material as THREE.Material).opacity = 0.25;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = -0.61;
  grid.userData.decor = true;
  root.add(grid);

  const player = (color: number) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.26, 6, 12), mat(color));
    body.rotation.z = Math.PI / 2.6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 14), mat(0xe8c39a));
    head.position.set(0.26, 0.1, 0);
    g.add(body, head);
    return g;
  };

  const rows: { id: string; name: string; desc: string; coords: [number, number][]; team: 0 | 1 }[] = [
    {
      id: "front-home",
      name: "Front row (home)",
      desc: "Loosehead prop, hooker, tighthead prop. They bind first, control the hit and channel the ball back.",
      coords: [[-0.45, -0.36], [-0.45, 0], [-0.45, 0.36]],
      team: 0,
    },
    {
      id: "front-away",
      name: "Front row (away)",
      desc: "The opposing three. The contest is won here through body height, angle and binding.",
      coords: [[0.45, -0.36], [0.45, 0], [0.45, 0.36]],
      team: 1,
    },
    {
      id: "second-home",
      name: "Second row (home)",
      desc: "Locks bind between the props' legs and drive the platform forward.",
      coords: [[-0.95, -0.2], [-0.95, 0.2]],
      team: 0,
    },
    {
      id: "second-away",
      name: "Second row (away)",
      desc: "Opposing locks supplying the bulk of the counter-shove.",
      coords: [[0.95, -0.2], [0.95, 0.2]],
      team: 1,
    },
    {
      id: "back-home",
      name: "Back row (home)",
      desc: "Flankers and number 8 — they stabilise the scrum then detach first to attack or defend.",
      coords: [[-1.35, -0.5], [-1.35, 0.5], [-1.5, 0]],
      team: 0,
    },
    {
      id: "back-away",
      name: "Back row (away)",
      desc: "Opposing loose forwards, watching for a quick break off the base.",
      coords: [[1.35, -0.5], [1.35, 0.5], [1.5, 0]],
      team: 1,
    },
    {
      id: "halves",
      name: "Scrum-halves",
      desc: "One feeds the ball into the tunnel, the other pressures the base and the exit pass.",
      coords: [[-0.15, -1.1], [0.15, 1.1]],
      team: 0,
    },
  ];

  for (const r of rows) {
    const g = new THREE.Group();
    r.coords.forEach(([x, z]) => {
      const p = player(r.team === 0 ? 0x2f7fd6 : 0xd63a3a);
      p.position.set(x, -0.36, z);
      p.rotation.y = r.team === 0 ? 0 : Math.PI;
      g.add(p);
    });
    part(parts, root, r.id, r.name, r.desc, g, [r.coords[0][0] > 0 ? 1.4 : -1.4, 0.6, 0]);
  }

  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16).scale(1.5, 1, 1), mat(0xf2e6cf));
  ball.position.set(0, -0.5, 0.05);
  part(parts, root, "ball", "The ball", "Fed into the tunnel; the hooker strikes it back through the channel to the base.", ball, [0, 1.4, 0]);

  // force arrows
  const forces = new THREE.Group();
  for (const s of [-1, 1]) {
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(-s, 0, 0),
      new THREE.Vector3(s * 2.1, -0.2, 0),
      1.0,
      s > 0 ? 0xd63a3a : 0x2f7fd6,
      0.22,
      0.14,
    );
    forces.add(arrow);
  }
  part(parts, root, "forces", "Force vectors", "Roughly 1.5 tonnes of drive per pack, resolved through the hit and the bind.", forces, [0, 1.1, 0]);

  return {
    key: "scrum",
    title: "Rugby Scrum",
    subtitle: "Positions · roles · force analysis",
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      const shove = Math.sin(t * 1.6 * o.speed) * 0.06;
      parts.forEach((p) => {
        if (p.id.endsWith("home")) p.obj.position.x = p.base.x + shove;
        if (p.id.endsWith("away")) p.obj.position.x = p.base.x + shove;
      });
    },
  };
}

/* ----------------------------------------------------------------- building */

function building(): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];

  const found = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), mat(0x5d666e));
  found.position.y = -1.3;
  part(parts, root, "foundation", "Foundation", "Piles and raft slab transferring the whole load into competent ground.", found, [0, -1.6, 0]);

  const floors: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.7 - i * 0.05, 0.08, 1.7 - i * 0.05), mat(0x93a0ab));
    f.position.y = -1.05 + i * 0.42;
    floors.push(f);
    part(parts, root, `floor${i + 1}`, `Floor ${i + 1}`, "Composite slab on steel decking, carrying services in the ceiling void.", f, [0, 0.3 * (i + 1), 0]);
  }

  const core = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.7, 0.5), mat(0x6f7a85, { transparent: true, opacity: 0.85 }));
  core.position.y = 0.1;
  part(parts, root, "core", "Service core", "Lifts, stairs and risers; also the primary lateral stability element.", core, [2, 0.4, 0]);

  const facade = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.6, 1.85), wire(CY, 0.4));
  facade.position.y = 0.1;
  part(parts, root, "facade", "Facade", "Unitised curtain wall — weather seal, solar control and the building's identity.", facade, [0, 0, 2.4]);

  return {
    key: "building",
    title: "High-Rise Structure",
    subtitle: "Floors · core · envelope",
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      root.rotation.y = t * 0.18 * o.speed;
    },
  };
}

/* ------------------------------------------------------------------ generic */

function generic(query: string): ModelDef {
  const root = new THREE.Group();
  const parts: ModelPart[] = [];
  const seed = query.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (n: number) => ((Math.sin(seed * (n + 1)) + 1) / 2);

  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), wire(CY, 0.5));
  part(parts, root, "shell", "Outer shell", `Generated envelope approximating "${query}".`, shell, [0, 1.6, 0]);

  for (let i = 0; i < 5; i++) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(0.3 + rand(i) * 0.4, 0.3 + rand(i + 5) * 0.5, 0.3 + rand(i + 9) * 0.4),
      mat(i % 2 ? 0x6fa8c7 : 0x9aa4ae),
    );
    const a = (i / 5) * Math.PI * 2;
    g.position.set(Math.cos(a) * 0.5, (rand(i) - 0.5) * 0.7, Math.sin(a) * 0.5);
    part(parts, root, `mod${i}`, `Module ${i + 1}`, "A generated sub-assembly. Ask ARIA what this part does for a detailed explanation.", g, [
      Math.cos(a) * 2,
      0.3,
      Math.sin(a) * 2,
    ]);
  }

  return {
    key: "generic",
    title: query.replace(/^\w/, (c) => c.toUpperCase()),
    subtitle: "Procedural holographic model",
    parts,
    root,
    update: (t, o) => {
      if (!o.animate) return;
      root.rotation.y = t * 0.3 * o.speed;
    },
  };
}

/* ---------------------------------------------------------------- resolver */

export const MODEL_CATALOG = [
  { key: "earth", label: "Earth", terms: ["earth", "planet earth", "world", "globe"] },
  { key: "moon", label: "Moon", terms: ["moon", "luna"] },
  { key: "mars", label: "Mars", terms: ["mars", "red planet"] },
  { key: "saturn", label: "Saturn", terms: ["saturn", "ringed planet"] },
  { key: "solar", label: "Solar System", terms: ["solar system", "planets", "orbits"] },
  { key: "heart", label: "Human Heart", terms: ["heart", "cardiac", "cardiovascular"] },
  { key: "engine", label: "V8 Engine", terms: ["engine", "v8", "motor", "combustion", "car engine"] },
  { key: "rocket", label: "Rocket", terms: ["rocket", "launch vehicle", "spacecraft", "starship"] },
  { key: "aircraft", label: "Aircraft", terms: ["aircraft", "plane", "airplane", "jet", "airliner"] },
  { key: "computer", label: "Computer", terms: ["computer", "pc", "workstation", "motherboard", "electronics"] },
  { key: "atom", label: "Atom", terms: ["atom", "atomic", "molecule", "electron"] },
  { key: "scrum", label: "Rugby Scrum", terms: ["scrum", "rugby", "lineout", "maul"] },
  { key: "building", label: "Building", terms: ["building", "skyscraper", "tower", "architecture", "high rise"] },
] as const;

export function resolveModelKey(query: string): string {
  const q = query.toLowerCase();
  for (const m of MODEL_CATALOG) {
    if (m.terms.some((t) => q.includes(t))) return m.key;
  }
  return "generic";
}

export function buildModel(query: string): ModelDef {
  const key = resolveModelKey(query);
  switch (key) {
    case "earth":
      return planet("earth", "Earth", "Layers · atmosphere · moon", 0x2f7fd6, { atmosphere: true, moon: true });
    case "moon":
      return planet("moon", "The Moon", "Regolith · mantle · core", 0xb9b9b9);
    case "mars":
      return planet("mars", "Mars", "Layers · thin atmosphere", 0xc1440e, { atmosphere: true });
    case "saturn":
      return planet("saturn", "Saturn", "Ring system · layers", 0xe3c98d, { rings: true, atmosphere: true });
    case "solar":
      return solarSystem();
    case "heart":
      return heart();
    case "engine":
      return v8Engine();
    case "rocket":
      return rocket();
    case "aircraft":
      return aircraft();
    case "computer":
      return computer();
    case "atom":
      return atom();
    case "scrum":
      return scrum();
    case "building":
      return building();
    default:
      return generic(query);
  }
}
