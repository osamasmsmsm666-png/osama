
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
      // Blend the source photo's natural colors with the site's rose palette.
      const photoRed = point[4] ?? 0.8;
      const photoGreen = point[5] ?? 0.12;
      const photoBlue = point[6] ?? 0.2;
      const lift = 0.42 + detail * 0.58;
      colors[i * 3] = Math.min(1, (photoRed * 0.72 + 0.28) * lift);
      colors[i * 3 + 1] = Math.min(0.72, (photoGreen * 0.62 + 0.035) * lift);
      colors[i * 3 + 2] = Math.min(0.78, (photoBlue * 0.62 + 0.065) * lift);
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[#070607] text-white selection:bg-rose-300 selection:text-black">
      <section id="home" className="relative min-h-[820px] h-[100svh] overflow-hidden bg-[#030303] sm:min-h-[760px]">
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

        <header className="absolute inset-x-0 top-0 z-40 px-5 py-5 sm:px-6 md:px-12 md:py-6">
          <nav className="relative mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-4 md:pb-5">
            <a href="#home" className="group flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200/40 text-sm text-rose-200">P.</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/85 sm:text-[11px] sm:tracking-[0.28em]">Portrait in dots</span>
            </a>
            <div className="hidden items-center gap-9 text-[10px] uppercase tracking-[0.24em] text-white/55 md:flex">
              <a className="transition hover:text-rose-200" href="#about">About</a>
              <a className="transition hover:text-rose-200" href="#experience">Experience</a>
              <a className="transition hover:text-rose-200" href="#gallery">Gallery</a>
              <a className="transition hover:text-rose-200" href="#process">The process</a>
              <a className="transition hover:text-rose-200" href="#details">Details</a>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <a href="#contact" className="rounded-full border border-rose-200/40 px-3 py-2.5 text-[8px] uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-200 hover:text-black sm:px-5 sm:text-[9px] sm:tracking-[0.22em]">
                Get in touch <span aria-hidden="true">↗</span>
              </a>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:border-rose-200/60 hover:text-rose-100 md:hidden"
              >
                <span className="text-lg leading-none">{mobileMenuOpen ? "×" : "☰"}</span>
              </button>
            </div>
          </nav>
          {mobileMenuOpen && (
            <div id="mobile-navigation" className="mx-auto mt-3 max-w-7xl rounded-2xl border border-white/10 bg-[#10090c]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden">
              {[
                ["About", "#about"],
                ["Experience", "#experience"],
                ["Gallery", "#gallery"],
                ["The process", "#process"],
                ["Project details", "#details"],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-xl px-4 py-3.5 text-[10px] uppercase tracking-[0.22em] text-white/65 transition hover:bg-white/5 hover:text-rose-200"
                >
                  {label}
                  <span aria-hidden="true" className="text-rose-200/60">↗</span>
                </a>
              ))}
            </div>
          )}
        </header>

        <div className="pointer-events-none absolute inset-x-0 top-[19%] z-30 mx-auto max-w-7xl px-6 sm:top-[22%] sm:px-7 md:top-[25%] md:px-12">
          <div className="max-w-[420px]">
            <p className="mb-5 flex items-center gap-3 text-[9px] uppercase tracking-[0.38em] text-rose-200/75">
              <span className="h-px w-8 bg-rose-300/70" /> A study in digital form
            </p>
            <h1 className="text-[2.7rem] font-extralight leading-[0.98] tracking-[-0.055em] sm:text-6xl md:text-7xl">
              Art, shaped
              <br />
              <span className="font-normal italic text-rose-200">by particles.</span>
            </h1>
            <p className="mt-5 max-w-[290px] text-[11px] leading-5 text-white/55 sm:mt-6 sm:max-w-[310px] sm:text-xs sm:leading-6 md:text-sm">
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

        <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-3 pb-4 sm:gap-4 sm:px-4 sm:pb-7">
          <p className="text-center text-[9px] uppercase tracking-[0.3em] text-white/45">
            {revealed ? "The portrait, revealed" : "A portrait formed by thousands of points"}
          </p>
          <div className="flex w-full max-w-4xl flex-wrap items-center justify-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setRevealed((value) => !value)}
              className="rounded-full border border-rose-300/40 bg-black/50 px-3 py-2 text-[8px] uppercase tracking-[0.14em] text-rose-100 backdrop-blur-md transition-all hover:border-rose-200 hover:bg-rose-950/50 sm:px-5 sm:py-2.5 sm:text-[9px] sm:tracking-[0.2em]"
            >
              {revealed ? "Back to dots" : "Reveal portrait"}
            </button>
            <button
              type="button"
              onClick={() => { setRevealed(false); setWaveActive((value) => !value); }}
              aria-pressed={waveActive}
              className={\`rounded-full border px-3 py-2 text-[8px] uppercase tracking-[0.14em] backdrop-blur-md transition-all sm:px-5 sm:py-2.5 sm:text-[9px] sm:tracking-[0.2em] \${waveActive ? "border-cyan-200/80 bg-cyan-950/50 text-cyan-100" : "border-white/20 bg-black/50 text-white/65 hover:border-cyan-200/60 hover:text-cyan-100"}\`}
            >
              {waveActive ? "Stop wave" : "Particle wave"}
            </button>
            <button
              type="button"
              onClick={() => { setRevealed(false); setExplosionKey((value) => value + 1); }}
              className="rounded-full border border-amber-200/30 bg-black/50 px-3 py-2 text-[8px] uppercase tracking-[0.14em] text-amber-100/80 backdrop-blur-md transition-all hover:border-amber-100/70 sm:px-5 sm:py-2.5 sm:text-[9px] sm:tracking-[0.2em]"
            >
              Particle explosion
            </button>
            <button
              type="button"
              onClick={() => { setRevealed(false); setCursorFieldActive((value) => !value); }}
              aria-pressed={cursorFieldActive}
              className={\`rounded-full border px-3 py-2 text-[8px] uppercase tracking-[0.14em] backdrop-blur-md transition-all sm:px-5 sm:py-2.5 sm:text-[9px] sm:tracking-[0.2em] \${cursorFieldActive ? "border-emerald-200/70 bg-emerald-950/40 text-emerald-100" : "border-white/20 bg-black/50 text-white/65 hover:border-emerald-200/60 hover:text-emerald-100"}\`}
            >
              {cursorFieldActive ? "Stop cursor field" : "Cursor field"}
            </button>
            <button
              type="button"
              onClick={() => { setRevealed(false); setPulseActive((value) => !value); }}
              aria-pressed={pulseActive}
              className={\`rounded-full border px-3 py-2 text-[8px] uppercase tracking-[0.14em] backdrop-blur-md transition-all sm:px-5 sm:py-2.5 sm:text-[9px] sm:tracking-[0.2em] \${pulseActive ? "border-fuchsia-200/70 bg-fuchsia-950/40 text-fuchsia-100" : "border-white/20 bg-black/50 text-white/65 hover:border-fuchsia-200/60 hover:text-fuchsia-100"}\`}
            >
              {pulseActive ? "Stop pulse" : "Particle pulse"}
            </button>
          </div>
        </div>
      </section>

      <section id="about" className="relative overflow-hidden border-t border-white/10 bg-[#0b090a] px-6 py-24 sm:px-7 sm:py-28 md:px-12 md:py-36">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[42%] bg-[radial-gradient(ellipse_at_top_right,rgba(116,24,46,0.13),transparent_68%)]" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-12 md:grid-cols-[0.72fr_1.28fr] md:gap-20">
            <div className="flex flex-col justify-between">
              <div>
                <p className="flex items-center gap-3 text-[9px] uppercase tracking-[0.38em] text-rose-200/70">
                  <span className="h-px w-7 bg-rose-300/60" /> 01 — About the project
                </p>
                <h2 className="mt-8 max-w-sm text-4xl font-extralight leading-[1.12] tracking-[-0.055em] sm:text-5xl md:text-[3.6rem]">
                  More than an image.
                  <span className="mt-2 block italic text-rose-200">A living form.</span>
                </h2>
              </div>
              <div className="mt-12 hidden border-l border-rose-200/25 pl-5 md:block">
                <p className="text-[9px] uppercase tracking-[0.28em] text-white/35">Project overview</p>
                <p className="mt-3 text-xs leading-6 text-white/45">Photography, reimagined through a three-dimensional point cloud.</p>
              </div>
            </div>

            <div className="min-w-0">
              <div className="border-y border-white/10 py-8 sm:py-10">
                <p className="max-w-3xl text-lg font-light leading-8 text-white/75 sm:text-xl sm:leading-9">
                  Portrait in Dots explores the space between photography and digital sculpture. A familiar portrait is reimagined as a field of tiny points, giving a still image depth, movement, and a sense of life.
                </p>
                <div className="mt-8 flex items-center gap-3 text-[9px] uppercase tracking-[0.25em] text-rose-200/65">
                  <span className="h-px w-8 bg-rose-200/50" /> An interactive digital artwork
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-white/10">
                <div className="py-7 pr-3 sm:py-8 sm:pr-6">
                  <p className="text-2xl font-light tracking-tight text-rose-100 sm:text-3xl">3D</p>
                  <p className="mt-3 text-[8px] uppercase leading-4 tracking-[0.16em] text-white/40 sm:text-[9px] sm:tracking-[0.2em]">Particle form</p>
                </div>
                <div className="px-3 py-7 sm:px-6 sm:py-8">
                  <p className="text-2xl font-light tracking-tight text-rose-100 sm:text-3xl">Live</p>
                  <p className="mt-3 text-[8px] uppercase leading-4 tracking-[0.16em] text-white/40 sm:text-[9px] sm:tracking-[0.2em]">Motion response</p>
                </div>
                <div className="py-7 pl-3 sm:py-8 sm:pl-6">
                  <p className="text-2xl font-light tracking-tight text-rose-100 sm:text-3xl">Web</p>
                  <p className="mt-3 text-[8px] uppercase leading-4 tracking-[0.16em] text-white/40 sm:text-[9px] sm:tracking-[0.2em]">Interactive art</p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-5 text-[8px] uppercase tracking-[0.22em] text-white/30">
                <span>Concept · Form · Interaction</span>
                <span>01 / 05</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className="relative overflow-hidden bg-[#100c0e] px-6 py-24 sm:px-7 sm:py-28 md:px-12 md:py-36">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 border-b border-white/10 pb-10 md:grid-cols-[1fr_0.7fr] md:items-end md:pb-14">
            <div>
              <p className="flex items-center gap-3 text-[9px] uppercase tracking-[0.38em] text-rose-200/70">
                <span className="h-px w-7 bg-rose-300/60" /> 02 — The experience
              </p>
              <h2 className="mt-7 max-w-2xl text-4xl font-extralight leading-[1.1] tracking-[-0.055em] sm:text-5xl md:text-6xl">
                Details in every
                <span className="ml-2 italic text-rose-200">direction.</span>
              </h2>
            </div>
            <div className="md:justify-self-end md:pb-1">
              <p className="max-w-md text-sm leading-7 text-white/50">
                Explore the portrait in its different states. Each interaction reveals another side of the same digital artwork.
              </p>
              <p className="mt-5 text-[9px] uppercase tracking-[0.25em] text-white/30">Three ways to experience the artwork</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:mt-10 md:grid-cols-3">
            <article className="group flex min-h-[310px] flex-col border border-white/10 bg-[#0c090b] p-6 sm:p-8 md:min-h-[350px]">
              <div className="flex items-start justify-between">
                <span className="text-[9px] uppercase tracking-[0.24em] text-rose-200/70">01 / Form</span>
                <span className="text-4xl font-extralight tracking-[-0.08em] text-white/15 transition-colors duration-300 group-hover:text-rose-200/40">01</span>
              </div>
              <div className="mt-auto">
                <div className="mb-6 h-px w-full bg-white/10">
                  <div className="h-px w-1/3 bg-rose-200/60" />
                </div>
                <h3 className="text-2xl font-light tracking-tight text-white/90 sm:text-[1.7rem]">Thousands of points</h3>
                <p className="mt-4 max-w-sm text-sm leading-7 text-white/45">
                  The portrait is rebuilt from individual particles, creating a detailed sculptural silhouette.
                </p>
                <p className="mt-7 text-[8px] uppercase tracking-[0.22em] text-rose-200/55">Structure · Detail · Depth</p>
              </div>
            </article>

            <article className="group flex min-h-[310px] flex-col border border-white/10 bg-[#130d10] p-6 sm:p-8 md:min-h-[350px]">
              <div className="flex items-start justify-between">
                <span className="text-[9px] uppercase tracking-[0.24em] text-rose-200/70">02 / Motion</span>
                <span className="text-4xl font-extralight tracking-[-0.08em] text-white/15 transition-colors duration-300 group-hover:text-rose-200/40">02</span>
              </div>
              <div className="mt-auto">
                <div className="mb-6 h-px w-full bg-white/10">
                  <div className="h-px w-2/3 bg-rose-200/60" />
                </div>
                <h3 className="text-2xl font-light tracking-tight text-white/90 sm:text-[1.7rem]">A responsive canvas</h3>
                <p className="mt-4 max-w-sm text-sm leading-7 text-white/45">
                  Cursor movement and the interactive controls let the artwork respond in real time.
                </p>
                <p className="mt-7 text-[8px] uppercase tracking-[0.22em] text-rose-200/55">Movement · Response · Energy</p>
              </div>
            </article>

            <article className="group flex min-h-[310px] flex-col border border-white/10 bg-[#0c090b] p-6 sm:p-8 md:min-h-[350px]">
              <div className="flex items-start justify-between">
                <span className="text-[9px] uppercase tracking-[0.24em] text-rose-200/70">03 / Reveal</span>
                <span className="text-4xl font-extralight tracking-[-0.08em] text-white/15 transition-colors duration-300 group-hover:text-rose-200/40">03</span>
              </div>
              <div className="mt-auto">
                <div className="mb-6 h-px w-full bg-white/10">
                  <div className="h-px w-full bg-rose-200/60" />
                </div>
                <h3 className="text-2xl font-light tracking-tight text-white/90 sm:text-[1.7rem]">Original and abstract</h3>
                <p className="mt-4 max-w-sm text-sm leading-7 text-white/45">
                  Move between the original portrait and its particle interpretation with a smooth transition.
                </p>
                <p className="mt-7 text-[8px] uppercase tracking-[0.22em] text-rose-200/55">Photography · Contrast · Art</p>
              </div>
            </article>
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-5 text-[8px] uppercase tracking-[0.22em] text-white/30 sm:flex-row sm:items-center sm:justify-between">
            <span>One portrait, multiple perspectives</span>
            <span>02 / 05</span>
          </div>
        </div>
      </section>

      <section id="gallery" className="bg-[#080708] px-5 py-20 sm:px-8 sm:py-24 md:px-12 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-[9px] uppercase tracking-[0.38em] text-rose-200/70">03 — Selected visuals</p>
              <h2 className="mt-5 text-4xl font-extralight tracking-[-0.04em] sm:text-5xl">A closer look at the form.</h2>
            </div>
            <p className="max-w-sm text-sm leading-7 text-white/45">Three stages of the artwork, from the original portrait to the sculptural shapes used to build its particle form.</p>
          </div>

          <div className="mt-14 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <figure className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#100c0e]">
              <div className="relative min-h-[420px] overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(115,20,42,0.2),#050405_72%)] sm:min-h-[560px]">
                <img
                  src="/images/photo.png"
                  alt="Original portrait reference"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-contain p-8 transition-transform duration-700 ease-out group-hover:scale-[1.035] sm:p-12"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15" />
                <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/45 px-3 py-2 text-[8px] uppercase tracking-[0.24em] text-white/70 backdrop-blur-md">01 / Original portrait</span>
                <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-rose-200/75">The starting point</p>
                    <h3 className="mt-2 text-2xl font-light tracking-tight sm:text-3xl">The source image</h3>
                    <p className="mt-2 max-w-md text-xs leading-6 text-white/50">The photograph behind the entire digital sculpture.</p>
                  </div>
                  <span className="hidden text-3xl font-extralight text-white/25 sm:block">01</span>
                </figcaption>
              </div>
            </figure>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <figure className="group relative grid min-w-0 grid-cols-[0.9fr_1.1fr] overflow-hidden rounded-2xl border border-white/10 bg-[#100c0e]">
                <div className="relative min-h-[230px] overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(115,20,42,0.16),#050405_72%)] sm:min-h-[260px]">
                  <img
                    src="/images/clay-front.png"
                    alt="Front clay silhouette reference"
                    loading="lazy"
                    className="h-full w-full object-contain p-3 transition-transform duration-700 ease-out group-hover:scale-105 sm:p-5"
                  />
                </div>
                <figcaption className="flex flex-col justify-center border-l border-white/10 p-4 sm:p-6">
                  <span className="text-[8px] uppercase tracking-[0.22em] text-rose-200/70">02 / Front view</span>
                  <h3 className="mt-3 text-lg font-light sm:text-xl">The silhouette</h3>
                  <p className="mt-2 text-[11px] leading-5 text-white/40">The front-facing shape that guides the portrait outline.</p>
                  <span className="mt-5 text-xl font-extralight text-white/20">02</span>
                </figcaption>
              </figure>

              <figure className="group relative grid min-w-0 grid-cols-[0.9fr_1.1fr] overflow-hidden rounded-2xl border border-white/10 bg-[#100c0e]">
                <div className="relative min-h-[230px] overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(115,20,42,0.16),#050405_72%)] sm:min-h-[260px]">
                  <img
                    src="/images/clay-side.png"
                    alt="Side clay silhouette reference"
                    loading="lazy"
                    className="h-full w-full object-contain p-3 transition-transform duration-700 ease-out group-hover:scale-105 sm:p-5"
                  />
                </div>
                <figcaption className="flex flex-col justify-center border-l border-white/10 p-4 sm:p-6">
                  <span className="text-[8px] uppercase tracking-[0.22em] text-rose-200/70">03 / Side view</span>
                  <h3 className="mt-3 text-lg font-light sm:text-xl">The depth study</h3>
                  <p className="mt-2 text-[11px] leading-5 text-white/40">A side reference that informs the sculpture's 3D depth.</p>
                  <span className="mt-5 text-xl font-extralight text-white/20">03</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section id="process" className="border-y border-white/10 bg-[#0b090a] px-6 py-24 sm:px-7 sm:py-28 md:px-12 md:py-36">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 border-b border-white/10 pb-10 md:grid-cols-[0.9fr_0.7fr] md:items-end md:pb-14">
            <div>
              <p className="flex items-center gap-3 text-[9px] uppercase tracking-[0.38em] text-rose-200/70">
                <span className="h-px w-7 bg-rose-300/60" /> 04 — The process
              </p>
              <h2 className="mt-7 max-w-2xl text-4xl font-extralight leading-[1.1] tracking-[-0.055em] sm:text-5xl md:text-6xl">
                From pixels
                <span className="ml-2 italic text-rose-200">to particles.</span>
              </h2>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/50 md:justify-self-end">
              Every point has a place. Follow the transformation from a source photograph to an interactive three-dimensional portrait.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <div className="flex min-h-[320px] flex-col justify-between border border-white/10 bg-[#120d10] p-7 sm:p-9 lg:min-h-[440px]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-[0.28em] text-rose-200/65">Transformation map</span>
                <span className="text-[8px] uppercase tracking-[0.2em] text-white/30">01 — 03</span>
              </div>
              <div className="my-10 grid grid-cols-3 items-center gap-2 sm:gap-4">
                <div className="flex flex-col items-center text-center">
                  <div className="flex aspect-square w-full max-w-[104px] items-center justify-center border border-rose-200/20 bg-black/20">
                    <span className="text-4xl font-extralight text-rose-100/80">I</span>
                  </div>
                  <span className="mt-4 text-[8px] uppercase tracking-[0.18em] text-white/45 sm:text-[9px]">Image</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="flex aspect-square w-full max-w-[104px] items-center justify-center border border-rose-200/20 bg-black/20">
                    <span className="text-4xl font-extralight text-rose-100/80">D</span>
                  </div>
                  <span className="mt-4 text-[8px] uppercase tracking-[0.18em] text-white/45 sm:text-[9px]">Data</span>
                </div>
                <div className="flex flex-col items-center text-center">
                  <div className="flex aspect-square w-full max-w-[104px] items-center justify-center border border-rose-200/20 bg-black/20">
                    <span className="text-4xl font-extralight text-rose-100/80">3D</span>
                  </div>
                  <span className="mt-4 text-[8px] uppercase tracking-[0.18em] text-white/45 sm:text-[9px]">Sculpture</span>
                </div>
              </div>
              <div className="border-t border-white/10 pt-5">
                <p className="text-[9px] uppercase tracking-[0.25em] text-white/35">The creative pipeline</p>
                <p className="mt-2 text-sm font-light text-white/70">Image <span className="px-2 text-rose-200/70">→</span> Data <span className="px-2 text-rose-200/70">→</span> Sculpture</p>
              </div>
            </div>

            <div className="flex flex-col">
              <article className="grid grid-cols-[52px_1fr] gap-4 border-t border-white/10 py-6 sm:grid-cols-[72px_1fr] sm:gap-6 sm:py-8">
                <span className="text-2xl font-extralight tracking-tight text-rose-200 sm:text-3xl">01</span>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xl font-light text-white/90 sm:text-2xl">Capture the shape</h3>
                    <span className="text-[8px] uppercase tracking-[0.2em] text-white/30">Source image</span>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-white/45">Extract the portrait silhouette and image details to establish the visual structure of the artwork.</p>
                </div>
              </article>
              <article className="grid grid-cols-[52px_1fr] gap-4 border-t border-white/10 py-6 sm:grid-cols-[72px_1fr] sm:gap-6 sm:py-8">
                <span className="text-2xl font-extralight tracking-tight text-rose-200 sm:text-3xl">02</span>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xl font-light text-white/90 sm:text-2xl">Build the point cloud</h3>
                    <span className="text-[8px] uppercase tracking-[0.2em] text-white/30">Position & detail</span>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-white/45">Translate image information into individual points, each with its own position, depth, and color.</p>
                </div>
              </article>
              <article className="grid grid-cols-[52px_1fr] gap-4 border-y border-white/10 py-6 sm:grid-cols-[72px_1fr] sm:gap-6 sm:py-8">
                <span className="text-2xl font-extralight tracking-tight text-rose-200 sm:text-3xl">03</span>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xl font-light text-white/90 sm:text-2xl">Bring it to life</h3>
                    <span className="text-[8px] uppercase tracking-[0.2em] text-white/30">Interactive render</span>
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-white/45">Render the point cloud as a three-dimensional sculpture and connect it to real-time interaction.</p>
                </div>
              </article>
              <div className="mt-6 flex items-center justify-between text-[8px] uppercase tracking-[0.22em] text-white/30">
                <span>From a still image to a living form</span>
                <span>04 / 05</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="details" className="relative overflow-hidden border-t border-white/10 bg-[#100c0e] px-6 py-24 sm:px-7 sm:py-28 md:px-12 md:py-36">
        <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-rose-950/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <p className="flex items-center gap-3 text-[9px] uppercase tracking-[0.38em] text-rose-200/70">
                <span className="h-px w-7 bg-rose-300/60" /> 05 — Project details
              </p>
              <h2 className="mt-7 max-w-lg text-4xl font-extralight leading-[1.1] tracking-[-0.055em] sm:text-5xl md:text-6xl">
                The craft behind
                <span className="ml-2 italic text-rose-200">the image.</span>
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-white/50">
                A combination of web technologies turns image data into a real-time 3D experience, right inside the browser.
              </p>
              <a href="#home" className="mt-8 inline-flex items-center gap-3 text-[9px] uppercase tracking-[0.25em] text-rose-100/75 transition hover:text-rose-100">
                Explore the portrait <span aria-hidden="true">↑</span>
              </a>
            </div>

            <div className="border-y border-white/10">
              <div className="grid grid-cols-[1fr_auto] items-center gap-5 border-b border-white/10 py-6 sm:py-7">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.25em] text-rose-200/65">01 / Framework</p>
                  <h3 className="mt-2 text-xl font-light text-white/90 sm:text-2xl">Next.js & React</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40">The application structure and reusable interface.</p>
                </div>
                <span className="text-2xl font-extralight text-white/20">N/R</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-5 border-b border-white/10 py-6 sm:py-7">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.25em] text-rose-200/65">02 / 3D rendering</p>
                  <h3 className="mt-2 text-xl font-light text-white/90 sm:text-2xl">Three.js & React Three Fiber</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40">A GPU-rendered point cloud with interactive camera movement.</p>
                </div>
                <span className="text-2xl font-extralight text-white/20">3D</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] items-center gap-5 py-6 sm:py-7">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.25em] text-rose-200/65">03 / Styling</p>
                  <h3 className="mt-2 text-xl font-light text-white/90 sm:text-2xl">Tailwind CSS</h3>
                  <p className="mt-2 text-xs leading-6 text-white/40">Responsive layouts, typography, and visual consistency.</p>
                </div>
                <span className="text-2xl font-extralight text-white/20">CSS</span>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-5 text-[8px] uppercase tracking-[0.22em] text-white/30 sm:flex-row sm:items-center sm:justify-between">
            <span>Designed as an interactive web artwork</span>
            <span>05 / 05</span>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-[#070607] px-6 py-14 sm:px-7 sm:py-16 md:px-12 md:py-20">
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
