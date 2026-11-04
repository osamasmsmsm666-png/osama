
"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function ParticleModel() {
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useLoader(
    THREE.FileLoader,
    "/data/points.json"
  ) as string;

  const geometry = useMemo(() => {
    const data: number[][] = JSON.parse(positions);
    const array = new Float32Array(data.length * 3);

    data.forEach((point, i) => {
      array[i * 3] = point[0];
      array[i * 3 + 1] = point[1];
      array[i * 3 + 2] = point[2];
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(array, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [positions]);

  useFrame((state) => {
    if (!pointsRef.current) return;

    const targetY = state.pointer.x * 0.3;
    const targetX = -state.pointer.y * 0.15;

    pointsRef.current.rotation.y +=
      (targetY - pointsRef.current.rotation.y) * 0.04;

    pointsRef.current.rotation.x +=
      (targetX - pointsRef.current.rotation.x) * 0.04;

    pointsRef.current.position.y =
      Math.sin(state.clock.elapsedTime * 0.65) * 0.025;
  });

  return (
    <points ref={pointsRef} geometry={geometry} scale={1.3}>
      <pointsMaterial
        color="#B5122D"
        size={0.019}
        sizeAttenuation
        transparent
        opacity={0.95}
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
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
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
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#030303]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,rgba(100,8,25,0.16),transparent_48%)]" />
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: false }}
      >
        <AmbientDust />
        <ParticleModel />
      </Canvas>
    </div>
  );
}
