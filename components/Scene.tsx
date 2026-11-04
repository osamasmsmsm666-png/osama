
"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";

function ParticleModel({ waveActive }: { waveActive: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const positions = useLoader(THREE.FileLoader, "/data/points.json") as string;

  const data = useMemo(() => JSON.parse(positions) as number[][], [positions]);

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

    for (let i = 0; i < data.length; i++) {
      const x = data[i][0];
      const baseY = data[i][1];
      const baseZ = data[i][2];
      let offsetY = 0;
      let offsetZ = 0;

      if (waveActive) {
        const distance = x - waveCenter;
        const envelope = Math.exp(-(distance * distance) / 0.22);
        const ripple = Math.sin(distance * 13 - elapsed * 7);
        offsetY = envelope * ripple * 0.16;
        offsetZ = envelope * 0.22;
      }

      values[i * 3 + 1] = baseY + offsetY;
      values[i * 3 + 2] = baseZ + offsetZ;
    }
    positionAttribute.needsUpdate = true;

    const targetY = state.pointer.x * 0.3;
    const targetX = -state.pointer.y * 0.15;

    pointsRef.current.rotation.y += (targetY - pointsRef.current.rotation.y) * 0.04;
    pointsRef.current.rotation.x += (targetX - pointsRef.current.rotation.x) * 0.04;
    pointsRef.current.position.y = 0.16 + Math.sin(state.clock.elapsedTime * 0.65) * 0.025;
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

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#030303] text-white">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_48%,rgba(100,8,25,0.18),transparent_48%)]" />

      <div
        className={`absolute inset-0 z-10 transition-opacity duration-[1400ms] ease-in-out ${revealed ? "opacity-0" : "opacity-100"}`}
        aria-hidden={revealed}
      >
        <Canvas
          camera={{ position: [0, 0, 6.2], fov: 45 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: false }}
        >
          <AmbientDust />
          <ParticleModel waveActive={waveActive} />
        </Canvas>
      </div>

      <div
        className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-[1400ms] ease-in-out ${revealed ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!revealed}
      >
        <img
          src="/images/photo.png"
          alt="Portrait"
          className="h-full w-full object-contain"
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-6 md:p-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.45em] text-rose-300/70">Digital sculpture · 001</p>
          <h1 className="mt-2 text-xl font-light tracking-[0.18em] md:text-2xl">PORTRAIT IN DOTS</h1>
        </div>
        <p className="hidden text-[10px] uppercase tracking-[0.3em] text-white/35 md:block">Move your cursor to interact</p>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-4 p-7">
        <p className="text-center text-[10px] uppercase tracking-[0.3em] text-white/45">
          {revealed ? "The portrait, revealed" : "A portrait formed by thousands of points"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="rounded-full border border-rose-300/40 bg-black/40 px-7 py-3 text-[10px] uppercase tracking-[0.3em] text-rose-100 backdrop-blur-md transition-all duration-300 hover:border-rose-200 hover:bg-rose-950/50"
          >
            {revealed ? "Back to dots" : "Reveal portrait"}
          </button>
          <button
            type="button"
            onClick={() => {
              setRevealed(false);
              setWaveActive((value) => !value);
            }}
            aria-pressed={waveActive}
            className={`rounded-full border px-7 py-3 text-[10px] uppercase tracking-[0.3em] backdrop-blur-md transition-all duration-300 ${
              waveActive
                ? "border-cyan-200/80 bg-cyan-950/50 text-cyan-100 shadow-[0_0_28px_rgba(103,232,249,0.18)]"
                : "border-white/20 bg-black/40 text-white/65 hover:border-cyan-200/60 hover:text-cyan-100"
            }`}
          >
            {waveActive ? "Stop wave" : "Particle wave"}
          </button>
        </div>
      </div>
    </main>
  );
}
