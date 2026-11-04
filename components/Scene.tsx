
"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

function ParticleModel({
  waveActive,
  explosionKey,
  pulseActive,
  cursorFieldActive,
}: {
  waveActive: boolean;
  explosionKey: number;
  pulseActive: boolean;
  cursorFieldActive: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useLoader(THREE.FileLoader, "/data/points.json") as string;

  const data = useMemo(() => JSON.parse(positions) as number[][], [positions]);
  const explosionStart = useRef<number | null>(null);
  const previousExplosionKey = useRef(explosionKey);

  const explosionDirections = useMemo(() => {
    const directions = new Float32Array(data.length * 4);

    data.forEach((point, i) => {
      const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453;
      const randomA = (seed - Math.floor(seed)) * 2 - 1;
      const seedB = Math.sin(i * 269.5 + 183.3) * 24634.6345;
      const randomB = (seedB - Math.floor(seedB)) * 2 - 1;

      const dx = point[0] * 0.75 + randomA * 0.85;
      const dy = point[1] * 0.75 + randomB * 0.85;
      const dz = point[2] * 0.55 + 0.65;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const spread = 1.8 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) * 0.9;

      directions[i * 4] = dx / length;
      directions[i * 4 + 1] = dy / length;
      directions[i * 4 + 2] = dz / length;
      directions[i * 4 + 3] = spread;
    });

    return directions;
  }, [data]);

  const geometry = useMemo(() => {
    const array = new Float32Array(data.length * 3);
    const colors = new Float32Array(data.length * 3);

    data.forEach((point, i) => {
      array[i * 3] = point[0];
      array[i * 3 + 1] = point[1];
      array[i * 3 + 2] = point[2];

      const detail = point[3] ?? 0.45;
      const glow = 0.28 + detail * 0.9;
      colors[i * 3] = Math.min(1, glow);
      colors[i * 3 + 1] = 0.012 + detail * 0.025;
      colors[i * 3 + 2] = 0.035 + detail * 0.075;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(array, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [data]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
    const values = positionAttribute.array as Float32Array;
    const elapsed = state.clock.elapsedTime;
    const waveCenter = ((elapsed * 0.9) % 7) - 3.5;

    if (explosionKey !== previousExplosionKey.current) {
      previousExplosionKey.current = explosionKey;
      explosionStart.current = elapsed;
    }

    let explosionAmount = 0;
    if (explosionStart.current !== null) {
      const progress = elapsed - explosionStart.current;
      if (progress < 0.85) {
        const t = Math.min(1, progress / 0.85);
        explosionAmount = 1 - Math.pow(1 - t, 3);
      } else if (progress < 2.8) {
        const t = (progress - 0.85) / 1.95;
        explosionAmount = 1 - (t * t * (3 - 2 * t));
      } else {
        explosionStart.current = null;
      }
    }

    for (let i = 0; i < data.length; i++) {
      const x = data[i][0];
      const baseY = data[i][1];
      const baseZ = data[i][2];
      let offsetX = 0;
      let offsetY = 0;
      let offsetZ = 0;

      if (cursorFieldActive) {
        // Convert the normalized pointer into the portrait's local coordinate space.
        const cursorX = state.pointer.x * 2.8;
        const cursorY = state.pointer.y * 2.0;
        const dx = x - cursorX;
        const dy = baseY - cursorY;
        const distanceSquared = dx * dx + dy * dy;
        const influence = Math.exp(-distanceSquared / 0.16);
        const distance = Math.sqrt(distanceSquared) || 0.001;

        // A soft repulsion field: nearby particles drift away from the cursor.
        offsetX += (dx / distance) * influence * 0.24;
        offsetY += (dy / distance) * influence * 0.24;
        offsetZ += influence * 0.16;
      }

      if (waveActive) {
        const distance = x - waveCenter;
        const envelope = Math.exp(-(distance * distance) / 0.22);
        const ripple = Math.sin(distance * 13 - elapsed * 7);
        offsetY = envelope * ripple * 0.16;
        offsetZ = envelope * 0.22;
      }

      const burst = explosionAmount * explosionDirections[i * 4 + 3];
      const burstX = explosionDirections[i * 4] * burst;
      const burstY = explosionDirections[i * 4 + 1] * burst;
      const burstZ = explosionDirections[i * 4 + 2] * burst;

      values[i * 3] = x + offsetX + burstX;
      values[i * 3 + 1] = baseY + offsetY + burstY;
      values[i * 3 + 2] = baseZ + offsetZ + burstZ;
    }
    positionAttribute.needsUpdate = true;

    const targetY = state.pointer.x * 0.3;
    const targetX = -state.pointer.y * 0.15;

    pointsRef.current.rotation.y += (targetY - pointsRef.current.rotation.y) * 0.04;
    pointsRef.current.rotation.x += (targetX - pointsRef.current.rotation.x) * 0.04;
    pointsRef.current.position.y = 0.16 + Math.sin(state.clock.elapsedTime * 0.65) * 0.025;

    const material = pointsRef.current.material as THREE.PointsMaterial;
    const pulse = pulseActive ? (Math.sin(elapsed * 2.4) + 1) * 0.5 : 0;
    material.size = 0.016 + pulse * 0.006;
    material.opacity = 0.82 + pulse * 0.16;
  });

  return (
    <points ref={pointsRef} geometry={geometry} scale={1.15}>
      <pointsMaterial
        vertexColors
        size={0.016}
        sizeAttenuation
        transparent
        opacity={0.96}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function AmbientDust() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 900;
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      values[i * 3] = (Math.random() - 0.5) * 12;
      values[i * 3 + 1] = (Math.random() - 0.5) * 8;
      values[i * 3 + 2] = (Math.random() - 0.5) * 5 - 1;
    }
    return values;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.08) * 0.035;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * 0.12) * 0.08;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#7D2635"
        size={0.012}
        transparent
        opacity={0.38}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export default function Scene() {
  const [revealed, setRevealed] = useState(false);
  const [waveActive, setWaveActive] = useState(false);
  const [explosionKey, setExplosionKey] = useState(0);
  const [pulseActive, setPulseActive] = useState(false);
  const [cursorFieldActive, setCursorFieldActive] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070607] text-white selection:bg-rose-300 selection:text-black">
      <section id="home" className="relative min-h-[760px] h-screen overflow-hidden bg-[#030303]">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_58%_48%,rgba(100,8,25,0.22),transparent_52%)]" />

        <div
          className={\`absolute inset-0 z-10 transition-opacity duration-[1400ms] ease-in-out \${revealed ? "opacity-0" : "opacity-100"}\`}
          aria-hidden={revealed}
        >
          <Canvas
            camera={{ position: [0, 0, 6.2], fov: 45 }}
            dpr={[1, 1.75]}
            gl={{ antialias: true, alpha: false }}
          >
            <AmbientDust />
            <ParticleModel
              waveActive={waveActive}
              explosionKey={explosionKey}
              pulseActive={pulseActive}
              cursorFieldActive={cursorFieldActive}
            />
          </Canvas>
        </div>

        <div
          className={\`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-[1400ms] ease-in-out \${revealed ? "opacity-100" : "pointer-events-none opacity-0"}\`}
          aria-hidden={!revealed}
        >
          <img
            src="/images/photo.png"
            alt="Portrait"
            className="h-full w-full object-contain"
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-black/55 via-transparent to-black/75" />

        <header className="absolute inset-x-0 top-0 z-40 px-6 py-6 md:px-12">
          <nav className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-5">
            <a href="#home" className="group flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200/40 text-sm text-rose-200">P.</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/85">Portrait in dots</span>
            </a>
            <div className="hidden items-center gap-9 text-[10px] uppercase tracking-[0.24em] text-white/55 md:flex">
              <a className="transition hover:text-rose-200" href="#about">About</a>
              <a className="transition hover:text-rose-200" href="#experience">Experience</a>
              <a className="transition hover:text-rose-200" href="#process">The process</a>
            </div>
            <a href="#contact" className="rounded-full border border-rose-200/40 px-5 py-2.5 text-[9px] uppercase tracking-[0.22em] text-rose-100 transition hover:bg-rose-200 hover:text-black">
              Get in touch <span aria-hidden="true">↗</span>
            </a>
          </nav>
        </header>

        <div className="pointer-events-none absolute inset-x-0 top-[22%] z-30 mx-auto max-w-7xl px-7 md:top-[25%] md:px-12">
          <div className="max-w-[420px]">
            <p className="mb-5 flex items-center gap-3 text-[9px] uppercase tracking-[0.38em] text-rose-200/75">
              <span className="h-px w-8 bg-rose-300/70" /> A study in digital form
            </p>
            <h1 className="text-5xl font-extralight leading-[0.98] tracking-[-0.055em] sm:text-6xl md:text-7xl">
              Art, shaped
              <br />
              <span className="font-normal italic text-rose-200">by particles.</span>
            </h1>
            <p className="mt-6 max-w-[310px] text-xs leading-6 text-white/55 md:text-sm">
              A portrait transformed into a living digital sculpture, built from thousands of individual points.
            </p>
            <a href="#about" className="pointer-events-auto mt-8 inline-flex items-center gap-4 text-[9px] uppercase tracking-[0.28em] text-white/80 transition hover:text-rose-200">
              Discover the project <span className="text-lg">↓</span>
            </a>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-32 left-7 z-30 hidden text-[9px] uppercase tracking-[0.3em] text-white/35 md:block md:left-12">
          <span className="text-rose-200/70">01</span> / Digital sculpture
        </div>

        <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-4 px-4 pb-7">
          <p className="text-center text-[9px] uppercase tracking-[0.3em] text-white/45">
            {revealed ? "The portrait, revealed" : "A portrait formed by thousands of points"}
          </p>
          <div className="flex max-w-4xl flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              className="rounded-full border border-rose-300/40 bg-black/50 px-5 py-2.5 text-[9px] uppercase tracking-[0.2em] text-rose-100 backdrop-blur-md transition-all hover:border-rose-200 hover:bg-rose-950/50"
            >
              {revealed ? "Back to dots" : "Reveal portrait"}
            </button>
            <button
              type="button"
              onClick={() => { setRevealed(false); setWaveActive((value) => !value); }}
              aria-pressed={waveActive}
              className={\`rounded-full border px-5 py-2.5 text-[9px] uppercase tracking-[0.2em] backdrop-blur-md transition-all \${waveActive ? "border-cyan-200/80 bg-cyan-950/50 text-cyan-100" : "border-white/20 bg-black/50 text-white/65 hover:border-cyan-200/60 hover:text-cyan-100"}\`}
            >
              {waveActive ? "Stop wave" : "Particle wave"}
            </button>
            <button
              type="button"
              onClick={() => { setRevealed(false); setExplosionKey((value) => value + 1); }}
              className="rounded-full border border-amber-200/30 bg-black/50 px-5 py-2.5 text-[9px] uppercase tracking-[0.2em] text-amber-100/80 backdrop-blur-md transition-all hover:border-amber-100/70"
            >
              Particle explosion
            </button>
            <button
              type="button"
              onClick={() => { setRevealed(false); setCursorFieldActive((value) => !value); }}
              aria-pressed={cursorFieldActive}
              className={\`rounded-full border px-5 py-2.5 text-[9px] uppercase tracking-[0.2em] backdrop-blur-md transition-all \${cursorFieldActive ? "border-emerald-200/70 bg-emerald-950/40 text-emerald-100" : "border-white/20 bg-black/50 text-white/65 hover:border-emerald-200/60 hover:text-emerald-100"}\`}
            >
              {cursorFieldActive ? "Stop cursor field" : "Cursor field"}
            </button>
            <button
              type="button"
              onClick={() => { setRevealed(false); setPulseActive((value) => !value); }}
              aria-pressed={pulseActive}
              className={\`rounded-full border px-5 py-2.5 text-[9px] uppercase tracking-[0.2em] backdrop-blur-md transition-all \${pulseActive ? "border-fuchsia-200/70 bg-fuchsia-950/40 text-fuchsia-100" : "border-white/20 bg-black/50 text-white/65 hover:border-fuchsia-200/60 hover:text-fuchsia-100"}\`}
            >
              {pulseActive ? "Stop pulse" : "Particle pulse"}
            </button>
          </div>
        </div>
      </section>

      <section id="about" className="relative border-t border-white/10 bg-[#0b090a] px-7 py-28 md:px-12 md:py-36">
        <div className="mx-auto grid max-w-7xl gap-14 md:grid-cols-[0.8fr_1.2fr] md:gap-24">
          <div>
            <p className="text-[9px] uppercase tracking-[0.38em] text-rose-200/70">01 — About the project</p>
            <h2 className="mt-6 text-4xl font-extralight leading-tight tracking-[-0.04em] md:text-5xl">
              More than an image.
              <br /><span className="italic text-rose-200">A living form.</span>
            </h2>
          </div>
          <div className="max-w-2xl self-end">
            <p className="text-base font-light leading-8 text-white/65 md:text-lg">
              Portrait in Dots explores the space between photography and digital sculpture. A familiar portrait is reimagined as a field of tiny points, giving a still image depth, movement, and a sense of life.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-6 border-t border-white/10 pt-6 sm:grid-cols-3">
              <div><p className="text-2xl font-light text-rose-100">3D</p><p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-white/40">Particle form</p></div>
              <div><p className="text-2xl font-light text-rose-100">Live</p><p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-white/40">Motion response</p></div>
              <div><p className="text-2xl font-light text-rose-100">Web</p><p className="mt-2 text-[9px] uppercase tracking-[0.2em] text-white/40">Interactive art</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className="bg-[#100c0e] px-7 py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-[9px] uppercase tracking-[0.38em] text-rose-200/70">02 — The experience</p>
              <h2 className="mt-5 text-4xl font-extralight tracking-[-0.04em] md:text-5xl">Details in every direction.</h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-white/45">Explore the portrait in its different states. Each interaction reveals another side of the same digital artwork.</p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
            <article className="bg-[#100c0e] p-8 md:p-10">
              <span className="text-[10px] tracking-[0.2em] text-rose-200/70">01 / FORM</span>
              <h3 className="mt-8 text-2xl font-light">Thousands of points</h3>
              <p className="mt-4 text-sm leading-7 text-white/45">The portrait is rebuilt from individual particles, creating a detailed sculptural silhouette.</p>
            </article>
            <article className="bg-[#100c0e] p-8 md:p-10">
              <span className="text-[10px] tracking-[0.2em] text-rose-200/70">02 / MOTION</span>
              <h3 className="mt-8 text-2xl font-light">A responsive canvas</h3>
              <p className="mt-4 text-sm leading-7 text-white/45">Cursor movement and the interactive controls let the artwork respond in real time.</p>
            </article>
            <article className="bg-[#100c0e] p-8 md:p-10">
              <span className="text-[10px] tracking-[0.2em] text-rose-200/70">03 / REVEAL</span>
              <h3 className="mt-8 text-2xl font-light">Original and abstract</h3>
              <p className="mt-4 text-sm leading-7 text-white/45">Move between the original portrait and its particle interpretation with a smooth transition.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="process" className="border-y border-white/10 bg-[#0b090a] px-7 py-24 md:px-12 md:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#120d10] p-8 md:p-12">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-rose-900/20 blur-3xl" />
            <div className="relative">
              <p className="text-[9px] uppercase tracking-[0.38em] text-rose-200/70">Behind the image</p>
              <div className="mt-10 flex aspect-square items-center justify-center rounded-full border border-rose-200/10">
                <div className="flex h-3/4 w-3/4 items-center justify-center rounded-full border border-rose-200/15">
                  <div className="h-2/3 w-2/3 rounded-full border border-rose-200/20 bg-[radial-gradient(circle,rgba(157,35,62,0.22),transparent_68%)]" />
                </div>
              </div>
              <p className="mt-8 text-center text-[9px] uppercase tracking-[0.3em] text-white/35">Image → Data → Sculpture</p>
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[0.38em] text-rose-200/70">03 — The process</p>
            <h2 className="mt-6 text-4xl font-extralight leading-tight tracking-[-0.04em] md:text-5xl">From pixels to particles.</h2>
            <p className="mt-7 text-sm leading-8 text-white/55">
              The artwork begins with an image, which is translated into a structured point cloud. Position, depth, and visual detail work together to rebuild the portrait in a three-dimensional space.
            </p>
            <div className="mt-9 space-y-5">
              <div className="flex gap-5 border-t border-white/10 pt-5"><span className="text-xs text-rose-200">01</span><div><h3 className="text-sm text-white/85">Capture the shape</h3><p className="mt-1 text-xs leading-6 text-white/40">Extract the portrait silhouette and image details.</p></div></div>
              <div className="flex gap-5 border-t border-white/10 pt-5"><span className="text-xs text-rose-200">02</span><div><h3 className="text-sm text-white/85">Build the point cloud</h3><p className="mt-1 text-xs leading-6 text-white/40">Give each particle its own position and color.</p></div></div>
              <div className="flex gap-5 border-t border-white/10 pt-5"><span className="text-xs text-rose-200">03</span><div><h3 className="text-sm text-white/85">Bring it to life</h3><p className="mt-1 text-xs leading-6 text-white/40">Render the sculpture and make it interactive.</p></div></div>
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-[#070607] px-7 py-16 md:px-12 md:py-20">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-10 md:flex-row md:items-end">
          <div>
            <p className="text-[9px] uppercase tracking-[0.38em] text-rose-200/70">A digital art experiment</p>
            <h2 className="mt-5 text-3xl font-extralight tracking-[-0.04em] md:text-4xl">Thanks for exploring.</h2>
            <p className="mt-4 max-w-md text-xs leading-6 text-white/40">An interactive portrait study, built for the web.</p>
          </div>
          <div className="flex flex-col gap-4 text-[9px] uppercase tracking-[0.22em] text-white/50 md:items-end">
            <a className="transition hover:text-rose-200" href="https://github.com/osamasmsmsm666-png/osama" target="_blank" rel="noreferrer">View source on GitHub ↗</a>
            <a className="transition hover:text-rose-200" href="#home">Back to top ↑</a>
          </div>
        </div>
        <div className="mx-auto mt-14 flex max-w-7xl justify-between border-t border-white/10 pt-6 text-[8px] uppercase tracking-[0.2em] text-white/25">
          <span>Portrait in dots</span><span>© 2026 — Digital sculpture</span>
        </div>
      </footer>
    </main>
  );
}
